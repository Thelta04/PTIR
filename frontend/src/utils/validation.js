export function getPasswordValidationMessage(password) {
  if (password.length < 6) {
    return 'A palavra-passe deve ter pelo menos 6 caracteres.';
  }
  if (!/[A-Za-z]/.test(password)) {
    return 'A palavra-passe deve conter pelo menos uma letra.';
  }
  if (!/[0-9]/.test(password)) {
    return 'A palavra-passe deve conter pelo menos um número.';
  }
  return '';
}

export function getLicenseNumberValidationMessage(licenseNumber) {
  if (licenseNumber.length > 12) {
    return 'O número da carta deve ter no máximo 12 caracteres.';
  }
  if (!/[A-Za-z]/.test(licenseNumber)) {
    return 'O número da carta deve conter pelo menos uma letra.';
  }
  if (!/[0-9]/.test(licenseNumber)) {
    return 'O número da carta deve conter pelo menos um número.';
  }
  return '';
}
