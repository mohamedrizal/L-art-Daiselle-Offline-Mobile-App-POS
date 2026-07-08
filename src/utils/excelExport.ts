import { File, Paths } from 'expo-file-system';
import * as XLSX from 'xlsx';

import { getOrderStatus, Order, PaymentMethod } from '@/context/AppContext';
import { ORDER_STATUS_LABEL } from '@/utils/orderStatus';

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export async function createExcelFile(orders: Order[]): Promise<File> {
  const sorted = [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const detailRows: (string | number)[][] = [
    [
      'No',
      'Tanggal',
      'Waktu',
      'Nama Pelanggan',
      'No. WhatsApp',
      'Item',
      'Qty',
      'Harga Satuan',
      'Subtotal',
      'Payment Method',
      'Status',
      'Total Order',
    ],
  ];

  sorted.forEach((order, index) => {
    const customerLabel =
      order.customerName +
      (order.groupMemberNames && order.groupMemberNames.length > 0
        ? ` (+${order.groupMemberNames.join(', ')})`
        : '');

    order.items.forEach((item) => {
      detailRows.push([
        index + 1,
        formatDate(order.createdAt),
        formatTime(order.createdAt),
        customerLabel,
        order.customerWhatsapp,
        item.name,
        item.qty,
        item.price,
        item.price * item.qty,
        PAYMENT_LABEL[order.paymentMethod],
        ORDER_STATUS_LABEL[getOrderStatus(order)],
        order.totalHarga,
      ]);
    });

    (order.addOns ?? []).forEach((addOn) => {
      detailRows.push([
        index + 1,
        formatDate(order.createdAt),
        formatTime(order.createdAt),
        customerLabel,
        order.customerWhatsapp,
        addOn.name,
        1,
        addOn.price,
        addOn.price,
        PAYMENT_LABEL[order.paymentMethod],
        ORDER_STATUS_LABEL[getOrderStatus(order)],
        order.totalHarga,
      ]);
    });
  });

  const completedOrders = sorted.filter((order) => getOrderStatus(order) === 'completed');

  const groupsByDate = new Map<string, Order[]>();
  for (const order of completedOrders) {
    const dateKey = order.createdAt.slice(0, 10);
    const group = groupsByDate.get(dateKey);
    if (group) {
      group.push(order);
    } else {
      groupsByDate.set(dateKey, [order]);
    }
  }

  const summaryRows: (string | number)[][] = [
    ['Tanggal', 'Total Pendapatan Kotor', 'Bagian Panitia (15%)', 'Keuntungan Pribadi (85%)'],
  ];

  let grandTotal = 0;
  for (const group of groupsByDate.values()) {
    const gross = group.reduce((sum, order) => sum + order.totalHarga, 0);
    grandTotal += gross;
    summaryRows.push([
      formatDate(group[0].createdAt),
      gross,
      Math.round(gross * 0.15),
      Math.round(gross * 0.85),
    ]);
  }
  summaryRows.push(['Grand Total', grandTotal, Math.round(grandTotal * 0.15), Math.round(grandTotal * 0.85)]);

  const refundOrders = sorted.filter((order) => getOrderStatus(order) === 'refund');
  const refundTotal = refundOrders.reduce((sum, order) => sum + order.totalHarga, 0);
  summaryRows.push([]);
  summaryRows.push(['Total Order Refund (Jumlah)', refundOrders.length]);
  summaryRows.push(['Total Order Refund (Nominal)', refundTotal]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(detailRows), 'Detail Order');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'Ringkasan');

  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });

  const file = new File(Paths.cache, `Laporan-Order-${Date.now()}.xlsx`);
  file.create({ overwrite: true });
  file.write(base64, { encoding: 'base64' });

  return file;
}
