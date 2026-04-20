interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
  positive?: boolean;
  negative?: boolean;
  icon: React.ReactNode;
  iconBg: string;
  gradient?: string;
}

export function StatCard({ title, value, sub, positive, negative, icon, iconBg, gradient }: StatCardProps) {
  const valueColor = positive ? "text-success" : negative ? "text-danger" : "text-teal";

  return (
    <div className={`card card-hover p-4 md:p-6 flex flex-col gap-3 overflow-hidden relative ${gradient ?? ""}`}>
      {/* Decorative circle */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-[0.06] bg-current pointer-events-none" />

      {/* Icon */}
      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm shrink-0 ${iconBg}`}>
        {icon}
      </div>

      {/* Numbers */}
      <div className="min-w-0">
        <p className="text-lo text-[10px] md:text-xs font-semibold uppercase tracking-widest mb-1 md:mb-2 whitespace-nowrap overflow-hidden text-ellipsis">
          {title}
        </p>
        <p className={`text-2xl md:text-[2.4rem] font-bold leading-none tracking-tight ${valueColor}`}>
          {value}
        </p>
        {sub && (
          <p className="text-mid text-[11px] md:text-xs mt-1.5 md:mt-2.5 font-medium truncate">{sub}</p>
        )}
      </div>
    </div>
  );
}
