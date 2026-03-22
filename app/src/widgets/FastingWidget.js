'use no memo';
import React from 'react';
import { FlexWidget, TextWidget, OverlapWidget } from 'react-native-android-widget';

export function FastingWidget({ fast }) {
  if (!fast) {
    return (
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 'match_parent',
          padding: 16,
          backgroundColor: '#111827',
          borderRadius: 16,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        clickAction="OPEN_APP"
      >
        <TextWidget
          text="No active fast"
          style={{ fontSize: 14, color: '#64748b' }}
        />
        <TextWidget
          text="Tap to start one"
          style={{ fontSize: 12, color: '#a78bfa', marginTop: 6 }}
        />
      </FlexWidget>
    );
  }

  const elapsedMs = Date.now() - new Date(fast.started_at).getTime();
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const targetSec = fast.target_hours * 3600;
  const progress = Math.min(elapsedSec / targetSec, 1);
  const pct = Math.round(progress * 100);

  const h = Math.floor(elapsedSec / 3600);
  const m = Math.floor((elapsedSec % 3600) / 60);
  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const remainSec = Math.max(0, targetSec - elapsedSec);
  const rh = Math.floor(remainSec / 3600);
  const rm = Math.floor((remainSec % 3600) / 60);
  const remainStr = remainSec > 0 ? `${rh}h ${rm}m left` : 'Goal reached!';

  const barColor = progress >= 1 ? '#34d399' : '#a78bfa';

  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        padding: 16,
        backgroundColor: '#111827',
        borderRadius: 16,
        flexDirection: 'column',
        justifyContent: 'center',
      }}
      clickAction="OPEN_APP"
    >
      {/* Header */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <TextWidget
          text={fast.preset || `${fast.target_hours}h Fast`}
          style={{ fontSize: 13, color: '#a78bfa', fontWeight: '700', letterSpacing: 0.5 }}
        />
        <TextWidget
          text={`${pct}%`}
          style={{ fontSize: 13, color: barColor, fontWeight: '700' }}
        />
      </FlexWidget>

      {/* Timer */}
      <TextWidget
        text={timeStr}
        style={{ fontSize: 32, color: '#e2e8f0', fontWeight: '800', marginBottom: 4 }}
      />

      {/* Remaining */}
      <TextWidget
        text={remainStr}
        style={{
          fontSize: 12,
          color: progress >= 1 ? '#34d399' : '#64748b',
          marginBottom: 12,
        }}
      />

      {/* Progress bar */}
      <OverlapWidget
        style={{
          width: 'match_parent',
          height: 6,
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 3,
        }}
      >
        <FlexWidget
          style={{
            width: `${Math.max(pct, 2)}%`,
            height: 6,
            backgroundColor: barColor,
            borderRadius: 3,
          }}
        />
      </OverlapWidget>
    </FlexWidget>
  );
}
