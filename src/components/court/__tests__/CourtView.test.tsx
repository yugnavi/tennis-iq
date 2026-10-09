import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CourtScene } from '../../../types';
import { CourtView, DEFAULT_SCENE_POINTS } from '../CourtView';

const scene: CourtScene = {
  player: { x: 25, y: 90 },
  opponent: { x: 70, y: 8 },
  ball: { x: 40, y: 60 },
  recommendedPath: [
    { x: 25, y: 90 },
    { x: 40, y: 75 },
    { x: 50, y: 70 },
  ],
  caption: 'You are deep in the left corner; the ball lands short near the right service line.',
};

describe('CourtView', () => {
  it('places markers at the normalized percentages', () => {
    render(<CourtView scene={scene} />);
    const player = screen.getByTestId('court-player');
    expect(player.style.left).toBe('25%');
    expect(player.style.top).toBe('90%');
    const opponent = screen.getByTestId('court-opponent');
    expect(opponent.style.left).toBe('70%');
    expect(opponent.style.top).toBe('8%');
    const ball = screen.getByTestId('court-ball');
    expect(ball.style.left).toBe('40%');
    expect(ball.style.top).toBe('60%');
  });

  it('renders the caption as visible text and labels the court image', () => {
    render(<CourtView scene={scene} />);
    expect(screen.getByText(scene.caption)).toBeVisible();
    const img = screen.getByRole('img', { name: /court diagram/i });
    expect(img.getAttribute('aria-label')).toContain(scene.caption);
    expect(img.style.aspectRatio).toBe('360 / 580');
  });

  it('uses the gameplay SVG for the requested surface', () => {
    const { container } = render(<CourtView scene={scene} surface="clay" />);
    const base = container.querySelector('img[src$="courts/gameplay/clay.svg"]');
    expect(base).not.toBeNull();
  });

  it('only shows the recommended path when highlight="path"', () => {
    const { rerender } = render(<CourtView scene={scene} />);
    expect(screen.queryByTestId('court-path')).toBeNull();
    rerender(<CourtView scene={scene} highlight="path" />);
    const svg = screen.getByTestId('court-path');
    expect(svg.getAttribute('viewBox')).toBe('0 0 100 100');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('none');
    expect(svg.querySelector('path')?.getAttribute('d')).toMatch(/^M 25 90/);
  });

  it('shows an empty court with idle markers when no scene is given', () => {
    render(<CourtView />);
    const player = screen.getByTestId('court-player');
    expect(player.style.left).toBe(`${DEFAULT_SCENE_POINTS.player.x}%`);
    expect(player.style.top).toBe(`${DEFAULT_SCENE_POINTS.player.y}%`);
    expect(screen.queryByTestId('court-ball')).toBeNull();
    expect(screen.getByText(/empty court/i)).toBeInTheDocument();
  });
});
