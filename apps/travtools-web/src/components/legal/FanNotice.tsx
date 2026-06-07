export const FAN_NOTICE =
  'Unofficial fan tool. Traveller ©2026 Mongoose Publishing Ltd. All rights reserved. Not affiliated with or endorsed by Mongoose Publishing.';

interface FanNoticeProps {
  compact?: boolean;
}

export default function FanNotice({ compact = false }: FanNoticeProps) {
  return (
    <div className={`text-[10px] text-body/60 font-mono tracking-wider ${compact ? '' : 'px-3 py-2'}`}>
      {FAN_NOTICE}
    </div>
  );
}
