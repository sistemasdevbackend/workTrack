export function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    HIGH: 'Alta',
    MEDIUM: 'Media',
    LOW: 'Baja',
  };
  return labels[priority] || priority;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'Pendiente',
    IN_PROGRESS: 'En Proceso',
    COMPLETED: 'Completada',
  };
  return labels[status] || status;
}

export function getStepTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    DATABASE: 'Base de Datos',
    CODE: 'Código',
    TESTING: 'Testing',
  };
  return labels[type] || type;
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('es-ES');
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('es-ES');
}

export function getDaysUntilDue(endDate: string | null): number | null {
  if (!endDate) return null;
  const today = new Date();
  const due = new Date(endDate);
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function isOverdue(endDate: string | null): boolean {
  const days = getDaysUntilDue(endDate);
  return days !== null && days < 0;
}

export function isUrgent(endDate: string | null): boolean {
  const days = getDaysUntilDue(endDate);
  return days !== null && days >= 0 && days <= 3;
}
