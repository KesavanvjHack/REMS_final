import { 
  CheckCircleIcon, 
  MinusCircleIcon, 
  MoonIcon,
  XCircleIcon 
} from '@heroicons/react/24/solid';

const StatusBadge = ({ status }) => {
  const config = {
    working: {
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
      border: 'border-emerald-400/30',
      icon: CheckCircleIcon,
      label: 'Working'
    },
    idle: {
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
      border: 'border-amber-400/30',
      icon: MoonIcon,
      label: 'Idle'
    },
    on_break: {
      color: 'text-cyan-400',
      bg: 'bg-cyan-400/10',
      border: 'border-cyan-400/30',
      icon: MinusCircleIcon,
      label: 'On Break'
    },
    online: {
      color: 'text-green-500', 
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      icon: CheckCircleIcon,
      label: 'Online'
    },
    offline: {
      color: 'text-slate-500',
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/30',
      icon: XCircleIcon,
      label: 'Offline'
    }
  };

  const { color, bg, border, icon: Icon, label } = config[status] || config.offline;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${bg} ${border} ${color}`}>
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium tracking-wide">{label}</span>
    </div>
  );
};

export default StatusBadge;
