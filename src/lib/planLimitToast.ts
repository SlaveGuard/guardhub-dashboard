import toast from 'react-hot-toast';

type ErrorLike = {
  response?: {
    data?: {
      message?: string | string[];
    };
  };
  message?: string;
};

export function getErrorMessage(error: unknown, fallback: string) {
  const message = (error as ErrorLike)?.response?.data?.message;
  if (Array.isArray(message)) {
    return message.join(', ');
  }
  return message || (error as ErrorLike)?.message || fallback;
}

export function showPlanLimitToast(
  error: unknown,
  fallback: string,
  navigate: (path: string) => void,
) {
  const message = getErrorMessage(error, fallback);
  toast.error(message);

  if (message.includes('plan allows up to')) {
    window.setTimeout(() => navigate('/subscription'), 1500);
  }
}
