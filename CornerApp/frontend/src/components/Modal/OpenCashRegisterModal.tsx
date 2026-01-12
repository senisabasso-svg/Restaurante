import { useState } from 'react';
import { DollarSign } from 'lucide-react';
import Modal from './Modal';

interface OpenCashRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (initialAmount: number) => Promise<void>;
}

export default function OpenCashRegisterModal({
  isOpen,
  onClose,
  onConfirm,
}: OpenCashRegisterModalProps) {
  const [initialAmount, setInitialAmount] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amount = parseFloat(initialAmount);
    if (isNaN(amount) || amount < 0) {
      setError('El monto inicial debe ser un número válido mayor o igual a 0');
      return;
    }

    try {
      setIsLoading(true);
      await onConfirm(amount);
      setInitialAmount('0');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al abrir la caja');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setInitialAmount('0');
      setError(null);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Abrir Caja" size="sm">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="initialAmount" className="block text-sm font-medium text-gray-700 mb-2">
              Monto inicial de cambio
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="number"
                id="initialAmount"
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
                step="0.01"
                min="0"
                disabled={isLoading}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="0.00"
                autoFocus
              />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Ingrese el monto de cambio que tiene disponible en caja
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              Abrir Caja
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
