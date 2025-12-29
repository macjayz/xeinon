interface LiveIndicatorProps {
  status?: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export const LiveIndicator = ({ status = 'connected' }: LiveIndicatorProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          color: 'bg-primary',
          text: 'Live',
          showPing: true,
        };
      case 'connecting':
        return {
          color: 'bg-yellow-500',
          text: 'Connecting...',
          showPing: true,
        };
      case 'disconnected':
        return {
          color: 'bg-muted-foreground',
          text: 'Reconnecting...',
          showPing: false,
        };
      case 'error':
        return {
          color: 'bg-destructive',
          text: 'Connection Error',
          showPing: false,
        };
      default:
        return {
          color: 'bg-primary',
          text: 'Live',
          showPing: true,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-2.5 w-2.5">
        {config.showPing && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${config.color} opacity-75`}></span>
        )}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${config.color}`}></span>
      </div>
      <span className={`text-xs font-medium uppercase tracking-wider ${status === 'connected' ? 'text-primary' : status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
        {config.text}
      </span>
    </div>
  );
};
