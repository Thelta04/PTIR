function parseLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (typeof value === 'string') {
    const localDateTimeMatch = value.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (localDateTimeMatch) {
      const [, year, month, day, hour = '0', minute = '0', second = '0'] = localDateTimeMatch;
      return new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      );
    }
  }

  return new Date(value);
}

export function formatDatePT(value) {
  if (!value) return '-';

  const date = parseLocalDate(value);

  if (!date || Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .format(date)
    .replaceAll('/', '-');
}

export function formatDateTimePT(value) {
  if (!value) return '-';

  const date = parseLocalDate(value);

  if (!date || Number.isNaN(date.getTime())) return '-';

  const formatted = new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  return formatted.replaceAll('/', '-');
}

export function formatTimePT(value) {
  if (!value) return '-';

  const date = parseLocalDate(value);

  if (!date || Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function dateInputToDisplay(value) {
  if (!value) return '';

  const [year, month, day] = value.split('-');

  if (!year || !month || !day) return value;

  return `${day}-${month}-${year}`;
}

export function displayToDateInput(value) {
  if (!value) return '';

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);

  if (!match) return null;

  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

export function dateTimeInputToDisplay(value) {
  if (!value) return '';

  const [datePart, timePart = ''] = value.split('T');
  const displayDate = dateInputToDisplay(datePart);

  return `${displayDate}${timePart ? ` ${timePart}` : ''}`;
}

export function displayToDateTimeInput(value) {
  if (!value) return '';

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:\s+(\d{2}):(\d{2}))?$/);

  if (!match) return null;

  const [, day, month, year, hour = '00', minute = '00'] = match;
  const dateInput = displayToDateInput(`${day}-${month}-${year}`);

  if (!dateInput || Number(hour) > 23 || Number(minute) > 59) return null;

  return `${dateInput}T${hour}:${minute}`;
}

export function dateInputToLocalDate(value) {
  if (!value) return null;

  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

export function todayDateInput() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function oneMonthFromNowDateInput() {
  const now = new Date();
  now.setMonth(now.getMonth() + 1);
  const pad = (value) => String(value).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function nowDateTimeInput() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function dateTimeInput(value) {
  const date = parseLocalDate(value);

  if (!date || Number.isNaN(date.getTime())) return '';

  const pad = (part) => String(part).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function plusHoursDateTimeInput(hours) {
  const date = new Date();
  date.setHours(date.getHours() + hours);

  const pad = (value) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
