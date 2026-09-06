import { Signal, signal } from '@angular/core';

/**
 * Watches the content width of the grid host. The content box is the measurement the
 * column arithmetic is written against, so a host that pads its container gives the grid
 * the width it actually has to divide.
 */
export class GridWidthObserver {
  private readonly measured = signal(0);
  private observer: ResizeObserver | null = null;

  readonly width: Signal<number> = this.measured.asReadonly();

  observe(host: HTMLElement): void {
    this.disconnect();
    this.observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) return;
      const box = entry.contentBoxSize?.[0];
      this.measured.set(box ? box.inlineSize : entry.contentRect.width);
    });
    this.observer.observe(host, { box: 'content-box' });
  }

  disconnect(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
