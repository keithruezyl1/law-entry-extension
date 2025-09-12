import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportJsonModal } from './ImportJsonModal';

describe('ImportJsonModal', () => {
  const mockOnClose = jest.fn();
  const mockOnImport = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when open', () => {
    render(
      <ImportJsonModal
        isOpen={true}
        onClose={mockOnClose}
        onImport={mockOnImport}
      />
    );

    expect(screen.getByText('Import Entry from JSON')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
    expect(screen.getByText('Import Entry')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <ImportJsonModal
        isOpen={false}
        onClose={mockOnClose}
        onImport={mockOnImport}
      />
    );

    expect(screen.queryByText('Import Entry from JSON')).not.toBeInTheDocument();
  });

  it('calls onClose when Go Back is clicked', () => {
    render(
      <ImportJsonModal
        isOpen={true}
        onClose={mockOnClose}
        onImport={mockOnImport}
      />
    );

    fireEvent.click(screen.getByText('Go Back'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows error for empty JSON', () => {
    render(
      <ImportJsonModal
        isOpen={true}
        onClose={mockOnClose}
        onImport={mockOnImport}
      />
    );

    fireEvent.click(screen.getByText('Import Entry'));
    expect(screen.getByText('Please enter JSON text')).toBeInTheDocument();
    expect(mockOnImport).not.toHaveBeenCalled();
  });

  it('shows error for invalid JSON', () => {
    render(
      <ImportJsonModal
        isOpen={true}
        onClose={mockOnClose}
        onImport={mockOnImport}
      />
    );

    const textarea = screen.getByPlaceholderText('Paste your JSON entry here...');
    fireEvent.change(textarea, { target: { value: 'invalid json' } });
    fireEvent.click(screen.getByText('Import Entry'));

    expect(screen.getByText('Invalid JSON format. Please check your input.')).toBeInTheDocument();
    expect(mockOnImport).not.toHaveBeenCalled();
  });

  it('calls onImport with valid JSON', () => {
    render(
      <ImportJsonModal
        isOpen={true}
        onClose={mockOnClose}
        onImport={mockOnImport}
      />
    );

    const validJson = '{"entry_id": "test-123", "title": "Test Entry"}';
    const textarea = screen.getByPlaceholderText('Paste your JSON entry here...');
    fireEvent.change(textarea, { target: { value: validJson } });
    fireEvent.click(screen.getByText('Import Entry'));

    expect(mockOnImport).toHaveBeenCalledWith(validJson);
  });
});
