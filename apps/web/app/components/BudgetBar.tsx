interface BudgetBarProps {
  name: string;
  spent: number;
  allocated: number;
  percent: number;
  status: "ok" | "warning" | "over";
}

const STATUS: Record<string, { bar: string; badge: string; dot: string }> = {
  ok:      { bar: "bg-teal",    badge: "bg-teal/10 text-teal border-teal/20",       dot: "bg-teal"    },
  warning: { bar: "bg-warning", badge: "bg-warning/10 text-warning border-warning/20", dot: "bg-warning" },
  over:    { bar: "bg-danger",  badge: "bg-danger/10 text-danger border-danger/20",   dot: "bg-danger"  },
};

export function BudgetBar({ name, spent, allocated, percent, status }: BudgetBarProps) {
  const pct = Math.min(100, Math.round(percent));
  const s = STATUS[status];

  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
          <span className="text-hi text-sm font-medium">{name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-mid text-xs">
            ${spent.toLocaleString("es-AR")}
            <span className="text-lo"> / ${allocated.toLocaleString("es-AR")}</span>
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${s.badge}`}>
            {pct}%
          </span>
        </div>
      </div>
      <div className="h-2 bg-raised rounded-full overflow-hidden border border-border/60">
        <div
          className={`h-full ${s.bar} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
