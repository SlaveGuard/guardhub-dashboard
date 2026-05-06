type BreadcrumbItem = {
  label: string;
  onClick?: () => void;
};

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-2 text-xs text-slate-400" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
            {index > 0 ? <span className="text-slate-600">/</span> : null}
            {isLast || !item.onClick ? (
              <span className={isLast ? 'font-medium text-slate-100' : 'text-slate-400'}>{item.label}</span>
            ) : (
              <button
                type="button"
                onClick={item.onClick}
                className="cursor-pointer text-slate-400 transition-colors hover:text-slate-200"
              >
                {item.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
