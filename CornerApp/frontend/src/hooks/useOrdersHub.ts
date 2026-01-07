import { useEffect, useRef, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import type { Order } from '../types';

interface OrderStatusChangedEvent {
  orderId: number;
  status: string;
  deliveryPersonName?: string;
  timestamp: string;
}

interface UseOrdersHubOptions {
  onOrderCreated?: (order: Order) => void;
  onOrderUpdated?: (order: Order) => void;
  onOrderStatusChanged?: (event: OrderStatusChangedEvent) => void;
  onOrderDeleted?: (event: { orderId: number }) => void;
  onConnectionStatusChange?: (connected: boolean) => void;
}

export function useOrdersHub(options: UseOrdersHubOptions) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const optionsRef = useRef(options);
  
  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const connect = useCallback(async () => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/orders', {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Retry with exponential backoff: 0, 2, 4, 8, 16, 30, 30, 30... seconds
          if (retryContext.previousRetryCount < 5) {
            return Math.pow(2, retryContext.previousRetryCount) * 1000;
          }
          return 30000; // Max 30 seconds
        }
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // Event handlers
    connection.on('OrderCreated', (order: Order) => {
      console.log('🆕 useOrdersHub: Nuevo pedido recibido:', order);
      console.log('🆕 useOrdersHub: Tipo de order:', typeof order);
      console.log('🆕 useOrdersHub: Order.id:', order?.id);
      console.log('🆕 useOrdersHub: Order.status:', order?.status);
      console.log('🆕 useOrdersHub: Order.customerName:', order?.customerName);
      if (optionsRef.current.onOrderCreated) {
        console.log('🆕 useOrdersHub: Llamando onOrderCreated callback');
        optionsRef.current.onOrderCreated(order);
      } else {
        console.warn('⚠️ useOrdersHub: onOrderCreated callback no está definido');
      }
    });

    connection.on('OrderUpdated', (order: Order) => {
      console.log('🔄 useOrdersHub: Pedido actualizado:', order);
      if (optionsRef.current.onOrderUpdated) {
        optionsRef.current.onOrderUpdated(order);
      } else {
        console.warn('⚠️ useOrdersHub: onOrderUpdated callback no está definido');
      }
    });

    connection.on('OrderStatusChanged', (event: OrderStatusChangedEvent) => {
      console.log('📊 Estado de pedido cambiado:', event);
      optionsRef.current.onOrderStatusChanged?.(event);
    });

    connection.on('OrderDeleted', (event: { orderId: number }) => {
      console.log('🗑️ Pedido eliminado:', event);
      optionsRef.current.onOrderDeleted?.(event);
    });

    // Connection state handlers
    connection.onreconnecting(() => {
      console.log('🔄 Reconectando al hub de pedidos...');
      optionsRef.current.onConnectionStatusChange?.(false);
    });

    connection.onreconnected(() => {
      console.log('✅ Reconectado al hub de pedidos');
      optionsRef.current.onConnectionStatusChange?.(true);
    });

    connection.onclose(() => {
      console.log('❌ Conexión al hub de pedidos cerrada');
      optionsRef.current.onConnectionStatusChange?.(false);
    });

    try {
      await connection.start();
      console.log('✅ Conectado al hub de pedidos');
      
      // Join admin group
      await connection.invoke('JoinGroup', 'admin');
      console.log('👥 Unido al grupo admin');
      
      optionsRef.current.onConnectionStatusChange?.(true);
      connectionRef.current = connection;
    } catch (error) {
      console.error('❌ Error al conectar al hub de pedidos:', error);
      optionsRef.current.onConnectionStatusChange?.(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (connectionRef.current) {
      try {
        await connectionRef.current.stop();
        console.log('🔌 Desconectado del hub de pedidos');
      } catch (error) {
        console.error('Error al desconectar:', error);
      }
      connectionRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected: connectionRef.current?.state === signalR.HubConnectionState.Connected,
    reconnect: connect,
  };
}

