import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Yapper nav brand', () => {
  render(<App />);
  const linkElement = screen.getByText(/Yapper/i);
  expect(linkElement).toBeInTheDocument();
});
