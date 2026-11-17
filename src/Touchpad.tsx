import { useMemo, useRef } from 'react';
import { GestureResponderEvent, PanResponder, StyleSheet, Text, View } from 'react-native';

import HidMouse, { Button } from '../modules/hid-mouse';

const TAP_MAX_MS = 200;
const TAP_SLOP = 12; // dp
const SCROLL_STEP = 20; // dp of finger travel per wheel notch

type Props = { sensitivity: number };

/**
 * Gestures:
 *  - 1 finger drag → move cursor
 *  - 1 finger tap  → left click
 *  - 2 finger tap  → right click
 *  - 2 finger drag → scroll
 */
export default function Touchpad({ sensitivity }: Props) {
  const sens = useRef(sensitivity);
  sens.current = sensitivity;

  const g = useRef({
    lastX: 0,
    lastY: 0,
    lastCount: 0,
    maxPointers: 0,
    moved: 0,
    scrollAccum: 0,
    startTime: 0,
  }).current;

  const responder = useMemo(() => {
    const centroid = (e: GestureResponderEvent) => {
      const t = e.nativeEvent.touches;
      let x = 0;
      let y = 0;
      for (const p of t) {
        x += p.pageX;
        y += p.pageY;
      }
      const n = Math.max(t.length, 1);
      return { x: x / n, y: y / n, count: t.length };
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (e) => {
        const c = centroid(e);
        g.lastX = c.x;
        g.lastY = c.y;
        g.lastCount = c.count;
        g.maxPointers = c.count;
        g.moved = 0;
        g.scrollAccum = 0;
        g.startTime = Date.now();
      },

      onPanResponderMove: (e) => {
        const c = centroid(e);
        g.maxPointers = Math.max(g.maxPointers, c.count);

        // Finger count changed: re-anchor so the cursor doesn't jump.
        if (c.count !== g.lastCount) {
          g.lastX = c.x;
          g.lastY = c.y;
          g.lastCount = c.count;
          return;
        }

        const dx = c.x - g.lastX;
        const dy = c.y - g.lastY;
        g.lastX = c.x;
        g.lastY = c.y;
        g.moved += Math.abs(dx) + Math.abs(dy);

        if (g.maxPointers === 1) {
          HidMouse.move(dx * sens.current, dy * sens.current);
        } else if (c.count >= 2) {
          g.scrollAccum += dy;
          const steps = Math.trunc(g.scrollAccum / SCROLL_STEP);
          if (steps !== 0) {
            // Natural scrolling: fingers up → page moves up.
            HidMouse.scroll(steps);
            g.scrollAccum -= steps * SCROLL_STEP;
          }
        }
      },

      onPanResponderRelease: () => {
        const isTap = Date.now() - g.startTime < TAP_MAX_MS && g.moved < TAP_SLOP;
        if (isTap) HidMouse.click(g.maxPointers >= 2 ? Button.Right : Button.Left);
      },
    });
  }, [g]);

  return (
    <View style={styles.pad} {...responder.panHandlers}>
      <Text style={styles.hint}>Drag: move</Text>
      <Text style={styles.hint}>Tap: left click</Text>
      <Text style={styles.hint}>Two-finger tap: right click</Text>
      <Text style={styles.hint}>Two-finger drag: scroll</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    flex: 1,
    marginTop: 12,
    borderRadius: 24,
    backgroundColor: '#28282E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { color: '#96969F', fontSize: 14, lineHeight: 24 },
});
