import { describe, it, expect } from 'vitest';
import { attachRenderPostPanel } from '../renderPost';

describe('attachRenderPostPanel', () => {
  it('wires bloom and outline controls to render hooks', () => {
    const calls: any[] = [];
    const render = {
      setBloom: (e: any, s: any, th: any, r: any) => calls.push(['bloom', e, s, th, r]),
      setOutline: (e: any, s: any, t: any, c: any) => calls.push(['outline', e, s, t, c]),
      setInkOutline: (...args: any[]) => calls.push(['ink', ...args]),
      setVignette: (...args: any[]) => calls.push(['vign', ...args]),
    } as any;
    const rstate: any = {
      bloomEnabled: false,
      bloomStrength: 0.5,
      bloomThreshold: 0.8,
      bloomRadius: 0.2,
    };
    const postState: any = {
      outlineEnabled: false,
      outlineStrength: 2.5,
      outlineThickness: 1.0,
      outlineColor: '#ffffff',
      inkEnabled: false,
      inkThickness: 0.02,
      inkColor: '#000000',
      vignetteEnabled: false,
      vignetteStrength: 0.25,
      vignetteSoftness: 0.5,
    };

    const section = {} as any as HTMLElement;
    const rerender = () => {};
    // UI builder stubs that immediately invoke onChange with a toggled/new value
    const checkbox = (_p: any, label: string, value: boolean, onChange: (v: boolean) => void) => {
      onChange(!value);
      return label;
    };
    const slider = (
      _p: any,
      label: string,
      _min: number,
      _max: number,
      _step: number,
      value: number,
      onChange: (v: number) => void
    ) => {
      onChange(value + 0.1);
      return label;
    };
    const select = () => {};
    const colorPicker = (
      _p: any,
      label: string,
      value: string,
      onChange: (hex: string) => void
    ) => {
      onChange(value);
      return label;
    };

    attachRenderPostPanel({
      section,
      render,
      rstate,
      postState,
      refreshWarnings: () => {},
      checkbox: checkbox as any,
      select: select as any,
      slider: slider as any,
      colorPicker: colorPicker as any,
      rerender,
    });
    // Expect at least one bloom toggle and one outline call happened
    expect(calls.find((c) => c[0] === 'bloom')).toBeTruthy();
    expect(calls.find((c) => c[0] === 'outline')).toBeTruthy();
  });
});
