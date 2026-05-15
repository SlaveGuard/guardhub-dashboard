import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  ImagePlus,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { API_URL, apiClient } from '../../api/client';
import { PoseSkeleton3D } from './PoseSkeleton3D';

type PoseTasksPanelProps = {
  installationId: string;
  profileId: string;
  editable: boolean;
};

type PoseTask = {
  id: string;
  appInstallationId: string;
  name: string;
  durationSeconds: number;
  status: string;
  similarityThreshold: number;
  imageUrl: string;
  keypoints?: Keypoint[] | null;
  imageUrls?: string[] | null;
  session?: PoseSession | null;
};

type Keypoint = {
  index: number;
  x?: number;
  y?: number;
  wx?: number;
  wy?: number;
  wz?: number;
  visibility?: number;
  estimated?: boolean;
  absent?: boolean;
};

type PoseSession = {
  id: string;
  durationSeconds?: number | null;
  totalBreaches?: number | null;
  inPosePercent?: number | null;
  longestBreachSec?: number | null;
  passed?: boolean | null;
  finalScore?: number | null;
  ticks?: PoseSessionTick[];
};

type PoseSessionTick = {
  id: string;
  tickIndex: number;
  similarityScore: number;
  inPose: boolean;
  breach: boolean;
  recordedAt: string;
};

const cameraOptions = [
  { label: 'Face camera', value: 'front' },
  { label: 'Face wall', value: 'rear' },
  { label: 'Let child choose', value: 'child_choice' },
];

const poseImageSlotCount = 4;
const maxPoseImageBytes = 5 * 1024 * 1024;

function createEmptyImageSlots<T>() {
  return Array<T | null>(poseImageSlotCount).fill(null);
}

function statusTone(status: string) {
  if (status === 'completed') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
  if (status === 'expired' || status === 'extraction_failed') {
    return 'bg-rose-500/10 text-rose-600 dark:text-rose-300';
  }
  return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
}

function statusLabel(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return '0m';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function getTaskGroups(tasks: PoseTask[]) {
  return [
    {
      label: 'Pending',
      tasks: tasks.filter((task) => !['completed', 'expired'].includes(task.status)),
    },
    {
      label: 'Completed',
      tasks: tasks.filter((task) => task.status === 'completed'),
    },
    {
      label: 'Expired',
      tasks: tasks.filter((task) => task.status === 'expired'),
    },
  ];
}

function getReferenceImageUrls(task: PoseTask) {
  return (task.imageUrls?.length ? task.imageUrls : [task.imageUrl]).map(resolveReferenceImageUrl);
}

function getApiOrigin() {
  return API_URL.replace(/\/+$/, '').replace(/\/api\/v1\/?$/, '');
}

function resolveReferenceImageUrl(imageUrl: string) {
  const trimmed = imageUrl.trim();
  if (/^(https?:|blob:|data:)/i.test(trimmed)) return trimmed;

  const normalized = trimmed.replace(/\\/g, '/');
  const poseImagePrefix = 'uploads/pose-images/';
  const prefixIndex = normalized.indexOf(poseImagePrefix);
  if (prefixIndex >= 0) {
    return `${getApiOrigin()}/${normalized.slice(prefixIndex)}`;
  }

  return `${getApiOrigin()}/${poseImagePrefix}${normalized.split('/').pop()}`;
}

function PoseTaskReferencePreview({
  task,
  skeletonHeight = 220,
}: {
  task: PoseTask;
  skeletonHeight?: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          Reference Photos
        </p>
        <div className="flex flex-wrap gap-2">
          {getReferenceImageUrls(task).map((url, i) => (
            <img
              key={`${url}-${i}`}
              src={url}
              alt={`Reference ${i + 1}`}
              className="h-24 w-24 rounded-lg object-cover border border-slate-200 dark:border-white/10"
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          3D Pose Preview
          <span className="ml-1 font-normal text-slate-400">— rotate to verify angle</span>
        </p>
        {task.keypoints?.length ? (
          <PoseSkeleton3D keypoints={task.keypoints} height={skeletonHeight} />
        ) : (
          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400 dark:border-white/10">
            {task.status === 'extraction_failed'
              ? 'Extraction failed — re-upload images'
              : 'Processing keypoints…'}
          </div>
        )}
      </div>
    </div>
  );
}

export function PoseTasksPanel({
  installationId,
  profileId,
  editable,
}: PoseTasksPanelProps) {
  const queryClient = useQueryClient();
  const [taskName, setTaskName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [similarityPercent, setSimilarityPercent] = useState(70);
  const [toleranceWindowSec, setToleranceWindowSec] = useState(5);
  const [cameraPreference, setCameraPreference] = useState('child_choice');
  const [imageFiles, setImageFiles] = useState<(File | null)[]>(
    () => createEmptyImageSlots<File>(),
  );
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>(
    () => createEmptyImageSlots<string>(),
  );
  const imagePreviewsRef = useRef<(string | null)[]>(createEmptyImageSlots<string>());
  const [selectedTask, setSelectedTask] = useState<PoseTask | null>(null);
  const [taskPendingDelete, setTaskPendingDelete] = useState<PoseTask | null>(null);
  const [createdPreviewTaskId, setCreatedPreviewTaskId] = useState<string | null>(null);

  const tasksQueryKey = ['poseTasks', profileId];
  const { data: allTasks = [], isLoading } = useQuery<PoseTask[]>({
    queryKey: tasksQueryKey,
    queryFn: async () => (await apiClient.get(`/pose/tasks?profileId=${profileId}`)).data,
    refetchInterval: (query) => {
      const queryTasks = query.state.data ?? [];
      return queryTasks.some((task) => task.status === 'pending' && !task.keypoints?.length)
        ? 4000
        : false;
    },
  });

  const tasks = useMemo(
    () => allTasks.filter((task) => task.appInstallationId === installationId),
    [allTasks, installationId],
  );
  const currentSelectedTask = selectedTask
    ? tasks.find((task) => task.id === selectedTask.id) ?? selectedTask
    : null;
  const createdPreviewTask = createdPreviewTaskId
    ? tasks.find((task) => task.id === createdPreviewTaskId) ?? null
    : null;

  const reportQuery = useQuery<PoseSession>({
    queryKey: ['poseSession', selectedTask?.session?.id],
    queryFn: async () => (await apiClient.get(`/pose/sessions/${selectedTask?.session?.id}`)).data,
    enabled: !!selectedTask?.session?.id,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (): Promise<PoseTask> => {
      const filledImageFiles = imageFiles.filter((file): file is File => file !== null);
      if (filledImageFiles.length === 0) {
        throw new Error('Upload at least one reference image');
      }

      const formData = new FormData();
      formData.append('name', taskName.trim());
      formData.append('durationSeconds', String(durationMinutes * 60));
      formData.append('similarityThreshold', String(similarityPercent / 100));
      formData.append('toleranceWindowSec', String(toleranceWindowSec));
      formData.append('cameraPreference', cameraPreference);
      formData.append('appInstallationId', installationId);
      filledImageFiles.forEach((file) => formData.append('images', file));

      return (
        await apiClient.post('/pose/tasks', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data;
    },
    onSuccess: (createdTask) => {
      toast.success('Pose task assigned.');
      setCreatedPreviewTaskId(createdTask.id);
      setTaskName('');
      clearImageSlots();
      queryClient.invalidateQueries({ queryKey: tasksQueryKey });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Failed to assign pose task');
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => (await apiClient.delete(`/pose/tasks/${taskId}`)).data,
    onSuccess: (_data, taskId) => {
      toast.success('Pose task deleted.');
      setTaskPendingDelete(null);
      if (selectedTask?.id === taskId) {
        setSelectedTask(null);
      }
      if (createdPreviewTaskId === taskId) {
        setCreatedPreviewTaskId(null);
      }
      queryClient.invalidateQueries({ queryKey: tasksQueryKey });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Failed to delete pose task');
    },
  });

  useEffect(() => {
    return () => {
      imagePreviewsRef.current.forEach((previewUrl) => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      });
    };
  }, []);

  const selectedSession = reportQuery.data;
  const chartTicks = selectedSession?.ticks ?? [];
  const breachTicks = chartTicks.filter((tick) => tick.breach);
  const taskGroups = getTaskGroups(tasks);
  const canSubmit =
    editable &&
    taskName.trim().length > 0 &&
    imageFiles.some((file) => file !== null) &&
    !createTaskMutation.isPending;

  const clearImageSlots = () => {
    imagePreviewsRef.current.forEach((previewUrl) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    });
    const emptyFiles = createEmptyImageSlots<File>();
    const emptyPreviews = createEmptyImageSlots<string>();
    imagePreviewsRef.current = emptyPreviews;
    setImageFiles(emptyFiles);
    setImagePreviews(emptyPreviews);
  };

  const handleImageChange = (slotIndex: number, file: File | null) => {
    if (file && file.size > maxPoseImageBytes) {
      toast.error('Image must be 5 MB or smaller.');
      return;
    }

    setImageFiles((previousFiles) => {
      const nextFiles = [...previousFiles];
      nextFiles[slotIndex] = file;
      return nextFiles;
    });
    setImagePreviews((previousPreviews) => {
      const nextPreviews = [...previousPreviews];
      if (previousPreviews[slotIndex]) {
        URL.revokeObjectURL(previousPreviews[slotIndex]);
      }
      nextPreviews[slotIndex] = file ? URL.createObjectURL(file) : null;
      imagePreviewsRef.current = nextPreviews;
      return nextPreviews;
    });
  };

  if (currentSelectedTask) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        <div className="px-4 py-4 bg-slate-50 dark:bg-dark-900/60 flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {currentSelectedTask.name}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Session Report
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedTask(null)}
            className="btn-secondary py-2 px-3 flex items-center gap-2 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <div className="p-4 space-y-4">
          <PoseTaskReferencePreview task={currentSelectedTask} skeletonHeight={220} />

          {reportQuery.isLoading ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Loading report...</div>
          ) : !selectedSession ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/10 p-4 text-sm text-slate-500 dark:text-slate-400">
              Report is not available yet.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Duration', value: formatDuration(selectedSession.durationSeconds) },
                  {
                    label: 'In-Pose',
                    value: `${Math.round(selectedSession.inPosePercent ?? 0)}%`,
                  },
                  { label: 'Breaches', value: selectedSession.totalBreaches ?? 0 },
                  {
                    label: 'Longest',
                    value: `${selectedSession.longestBreachSec ?? 0}s`,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-slate-200 dark:border-white/10 p-3 bg-white/70 dark:bg-dark-900/50"
                  >
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {item.label}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-64 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-900/40 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartTicks}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.25} />
                    <XAxis dataKey="tickIndex" tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 1]} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <ReferenceLine
                      y={currentSelectedTask.similarityThreshold}
                      stroke="#f97316"
                      label="Threshold"
                    />
                    {breachTicks.map((tick) => (
                      <ReferenceLine
                        key={`${tick.id}-${tick.tickIndex}`}
                        x={tick.tickIndex}
                        stroke="#ef4444"
                        strokeOpacity={0.3}
                      />
                    ))}
                    <Line
                      type="monotone"
                      dataKey="similarityScore"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
      <div className="px-4 py-4 bg-slate-50 dark:bg-dark-900/60">
        <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand-500" />
          GuardStance Tasks
        </div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Assign and review reference pose sessions.
        </div>
      </div>

      <div className="p-4 space-y-5">
        {editable ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              createTaskMutation.mutate();
            }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Task name
                <input
                  value={taskName}
                  onChange={(event) => setTaskName(event.target.value)}
                  className="glass-input mt-2"
                />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Pose direction
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {cameraOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCameraPreference(option.value)}
                      className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                        cameraPreference === option.value
                          ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300'
                          : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Duration: {durationMinutes} min
                <input
                  type="range"
                  min={1}
                  max={60}
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(Number(event.target.value))}
                  className="mt-3 w-full accent-brand-600"
                />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                How strict: {similarityPercent}%
                <input
                  type="range"
                  min={50}
                  max={95}
                  value={similarityPercent}
                  onChange={(event) => setSimilarityPercent(Number(event.target.value))}
                  className="mt-3 w-full accent-brand-600"
                />
              </label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Grace period: {toleranceWindowSec}s
                <input
                  type="range"
                  min={3}
                  max={30}
                  value={toleranceWindowSec}
                  onChange={(event) => setToleranceWindowSec(Number(event.target.value))}
                  className="mt-3 w-full accent-brand-600"
                />
              </label>
            </div>

            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Reference images
                <span className="ml-1 text-xs font-normal text-slate-400">
                  (1 required, up to 4)
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {imagePreviews.map((previewUrl, slotIndex) => (
                  <div key={slotIndex} className="relative">
                    <label
                      className={`flex h-28 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
                        previewUrl
                          ? 'border-brand-500 bg-brand-500/10'
                          : 'border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-white/10 dark:bg-dark-900/60 dark:hover:bg-dark-800/70'
                      }`}
                    >
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={`Reference ${slotIndex + 1}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-400">
                          <ImagePlus className="h-7 w-7" />
                          <span className="text-xs">
                            {slotIndex === 0 ? 'Required' : 'Optional'}
                          </span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        className="hidden"
                        onChange={(event) => {
                          handleImageChange(
                            slotIndex,
                            event.target.files?.[0] ?? null,
                          );
                          event.target.value = '';
                        }}
                      />
                    </label>

                    {previewUrl ? (
                      <button
                        type="button"
                        onClick={() => handleImageChange(slotIndex, null)}
                        className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm transition-colors hover:bg-rose-500"
                        aria-label={`Remove reference ${slotIndex + 1}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    <div className="mt-1 text-center text-xs text-slate-400">
                      Angle {slotIndex + 1}
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-2 text-xs text-slate-400">
                Use the same pose from front, angled, or side views when possible.
              </p>
            </div>

            {createdPreviewTask ? (
              <div className="rounded-xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-dark-900/40">
                <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Latest assigned task preview
                </p>
                <PoseTaskReferencePreview task={createdPreviewTask} skeletonHeight={220} />
              </div>
            ) : null}

            <button
              type="submit"
              className="btn-primary flex items-center justify-center gap-2"
              disabled={!canSubmit}
            >
              <Upload className="h-4 w-4" />
              {createTaskMutation.isPending ? 'Assigning...' : 'Assign Task'}
            </button>
          </form>
        ) : null}

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/10 p-4 text-sm text-slate-500 dark:text-slate-400">
              No GuardStance tasks yet.
            </div>
          ) : (
            taskGroups.map((group) => (
              <div key={group.label} className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {group.label}
                </div>
                {group.tasks.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">None</div>
                ) : (
                  group.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-xl border border-slate-200 dark:border-white/10 p-3 bg-white/70 dark:bg-dark-900/40"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {task.name}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-dark-700 px-2 py-1 text-xs text-slate-600 dark:text-slate-300">
                              <Clock3 className="h-3 w-3" />
                              {formatDuration(task.durationSeconds)}
                            </span>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone(task.status)}`}
                            >
                              {statusLabel(task.status)}
                            </span>
                            {task.status === 'completed' ? (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                                  task.session?.passed
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-300'
                                }`}
                              >
                                {task.session?.passed ? (
                                  <CheckCircle2 className="h-3 w-3" />
                                ) : (
                                  <XCircle className="h-3 w-3" />
                                )}
                                {task.session?.passed ? 'Pass' : 'Fail'}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                          {task.status === 'completed' && task.session?.id ? (
                            <button
                              type="button"
                              onClick={() => setSelectedTask(task)}
                              className="btn-secondary py-2 px-3 text-sm"
                            >
                              View Report
                            </button>
                          ) : null}
                          {editable ? (
                            <button
                              type="button"
                              onClick={() => setTaskPendingDelete(task)}
                              disabled={deleteTaskMutation.isPending}
                              className="btn-danger inline-flex items-center gap-2 py-2 px-3 text-sm"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {taskPendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-pose-task-title"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/40"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="delete-pose-task-title" className="text-base font-semibold text-slate-100">
                  Delete {taskPendingDelete.name}?
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  This permanently removes the task and any session report from the task list.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTaskPendingDelete(null)}
                disabled={deleteTaskMutation.isPending}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Close delete confirmation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setTaskPendingDelete(null)}
                disabled={deleteTaskMutation.isPending}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteTaskMutation.mutate(taskPendingDelete.id)}
                disabled={deleteTaskMutation.isPending}
                className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleteTaskMutation.isPending ? 'Deleting...' : 'Delete Task'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
