import { render, screen } from '@testing-library/react';
import App from './App';

test('renders partial transcripts heading', () => {
  render(<App />);
  const heading = screen.getByText(/Partial Transcript Logs:/i);
  expect(heading).toBeInTheDocument();
});
