import { dateInputToDisplay, dateTimeInputToDisplay } from '../utils/dateFormat';

const pickerStyle = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  opacity: 0,
  cursor: 'pointer',
};

function getWrapperStyle(className) {
  const baseStyle = {
    position: 'relative',
    display: 'inline-block',
    width: 'fit-content',
  };

  if (className?.includes('schedule-input')) {
    return {
      ...baseStyle,
      display: 'block',
      width: '100%',
      flex: 1,
      minWidth: 100,
    };
  }

  return baseStyle;
}

function getDisplayStyle(style) {
  return {
    ...style,
    width: '100%',
    boxSizing: 'border-box',
    cursor: 'pointer',
  };
}

function openPicker(event) {
  if (typeof event.currentTarget.showPicker === 'function') {
    event.currentTarget.showPicker();
  }
}

export function EuropeanDateInput({ value, onChange, className, required, style, ...props }) {
  const displayValue = dateInputToDisplay(value);

  return (
    <span style={getWrapperStyle(className)}>
      <input
        className={className}
        style={getDisplayStyle(style)}
        type="text"
        value={displayValue}
        placeholder="DD-MM-AAAA"
        readOnly
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        {...props}
        type="date"
        lang="pt-PT"
        required={required}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onClick={openPicker}
        style={pickerStyle}
        title="Escolher data"
      />
    </span>
  );
}

export function EuropeanDateTimeInput({ value, onChange, className, required, style, ...props }) {
  const displayValue = dateTimeInputToDisplay(value);

  return (
    <span style={getWrapperStyle(className)}>
      <input
        className={className}
        style={getDisplayStyle(style)}
        type="text"
        value={displayValue}
        placeholder="DD-MM-AAAA HH:MM"
        readOnly
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        {...props}
        type="datetime-local"
        lang="pt-PT"
        required={required}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onClick={openPicker}
        style={pickerStyle}
        title="Escolher data e hora"
      />
    </span>
  );
}
