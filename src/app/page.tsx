'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { format, parseISO } from 'date-fns';
import toast, { Toaster } from 'react-hot-toast';

interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  paymentMethod: string;
  tags: string[];
  location?: string;
  receipt?: string;
}

interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  format: string;
  filters: Record<string, unknown>;
  fields: string[];
}

interface ExportHistory {
  id: string;
  timestamp: string;
  template: string;
  destination: string;
  status: 'completed' | 'processing' | 'failed' | 'scheduled';
  recordCount: number;
  fileSize?: string;
  shareUrl?: string;
}

interface CloudIntegration {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  status: 'active' | 'inactive' | 'syncing' | 'error';
  lastSync?: string;
}

const categories = ['Food & Dining', 'Transportation', 'Entertainment', 'Bills & Utilities', 'Shopping', 'Healthcare', 'Travel', 'Business', 'Other'];
const paymentMethods = ['Credit Card', 'Debit Card', 'Cash', 'Bank Transfer', 'Digital Wallet', 'Cryptocurrency'];

const exportTemplates: ExportTemplate[] = [
  {
    id: 'tax-report',
    name: 'Tax Report',
    description: 'Business expenses formatted for tax filing',
    icon: '📊',
    format: 'PDF',
    filters: { categories: ['Business', 'Travel'] },
    fields: ['date', 'category', 'amount', 'description', 'receipt']
  },
  {
    id: 'monthly-summary',
    name: 'Monthly Summary',
    description: 'Categorized breakdown by month',
    icon: '📅',
    format: 'Excel',
    filters: {},
    fields: ['date', 'category', 'amount', 'description']
  },
  {
    id: 'expense-analysis',
    name: 'Expense Analysis',
    description: 'Detailed analytics with trends',
    icon: '📈',
    format: 'CSV',
    filters: {},
    fields: ['date', 'category', 'amount', 'description', 'tags', 'location']
  },
  {
    id: 'receipt-backup',
    name: 'Receipt Backup',
    description: 'All expenses with receipt attachments',
    icon: '🧾',
    format: 'ZIP',
    filters: { hasReceipt: true },
    fields: ['date', 'description', 'amount', 'receipt']
  }
];

const cloudIntegrations: CloudIntegration[] = [
  { id: 'google-sheets', name: 'Google Sheets', icon: '📊', connected: true, status: 'active', lastSync: '2025-08-04T10:30:00Z' },
  { id: 'dropbox', name: 'Dropbox', icon: '📦', connected: true, status: 'syncing' },
  { id: 'onedrive', name: 'OneDrive', icon: '☁️', connected: false, status: 'inactive' },
  { id: 'email', name: 'Email Reports', icon: '📧', connected: true, status: 'active', lastSync: '2025-08-04T09:15:00Z' },
  { id: 'slack', name: 'Slack', icon: '💬', connected: false, status: 'inactive' },
  { id: 'teams', name: 'Microsoft Teams', icon: '👥', connected: false, status: 'inactive' }
];

const sampleExpenses: Expense[] = [
  { id: '1', date: '2025-08-01', category: 'Food & Dining', amount: 25.50, description: 'Business lunch at The Grove', paymentMethod: 'Credit Card', tags: ['business', 'client-meeting'], location: 'Downtown LA', receipt: 'receipt-001.pdf' },
  { id: '2', date: '2025-08-02', category: 'Transportation', amount: 45.00, description: 'Airport transfer via Uber', paymentMethod: 'Digital Wallet', tags: ['travel', 'business-trip'], location: 'LAX Airport' },
  { id: '3', date: '2025-08-03', category: 'Bills & Utilities', amount: 120.00, description: 'Office internet - monthly subscription', paymentMethod: 'Bank Transfer', tags: ['recurring', 'office'], receipt: 'invoice-003.pdf' },
  { id: '4', date: '2025-07-28', category: 'Entertainment', amount: 35.00, description: 'Team building - movie night', paymentMethod: 'Credit Card', tags: ['team', 'entertainment'] },
  { id: '5', date: '2025-07-30', category: 'Shopping', amount: 89.99, description: 'Office supplies from Staples', paymentMethod: 'Debit Card', tags: ['office', 'supplies'], location: 'Staples Store', receipt: 'receipt-005.pdf' },
  { id: '6', date: '2025-08-04', category: 'Healthcare', amount: 150.00, description: 'Annual health checkup', paymentMethod: 'Credit Card', tags: ['health', 'personal'] },
];

export default function Home() {
  const [expenses, setExpenses] = useState<Expense[]>(sampleExpenses);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'export' | 'history' | 'integrations'>('dashboard');
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportHistory[]>([
    { id: '1', timestamp: '2025-08-04T10:30:00Z', template: 'Monthly Summary', destination: 'Google Sheets', status: 'completed', recordCount: 6, fileSize: '2.1 KB', shareUrl: 'https://docs.google.com/spreadsheets/d/abc123' },
    { id: '2', timestamp: '2025-08-04T09:15:00Z', template: 'Tax Report', destination: 'Email', status: 'completed', recordCount: 3, fileSize: '156 KB' },
    { id: '3', timestamp: '2025-08-04T08:45:00Z', template: 'Expense Analysis', destination: 'Dropbox', status: 'processing', recordCount: 6 },
  ]);
  
  const [shareUrl, setShareUrl] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: '1', message: 'Monthly summary exported to Google Sheets', type: 'success', timestamp: '2025-08-04T10:30:00Z' },
    { id: '2', message: 'Dropbox sync completed - 6 files updated', type: 'info', timestamp: '2025-08-04T10:25:00Z' },
  ]);

  const [formData, setFormData] = useState({
    date: '',
    category: categories[0],
    amount: '',
    description: '',
    paymentMethod: paymentMethods[0],
    tags: '',
    location: '',
    receipt: null as File | null
  });

  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    template: '',
    frequency: 'weekly',
    destination: 'email',
    time: '09:00',
    enabled: true
  });

  useEffect(() => {
    if (showShareModal && shareUrl) {
      QRCode.toDataURL(shareUrl, { width: 200, margin: 2 })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error(err));
    }
  }, [showShareModal, shareUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.amount || !formData.description) return;

    const newExpense: Expense = {
      id: Date.now().toString(),
      date: formData.date,
      category: formData.category,
      amount: parseFloat(formData.amount),
      description: formData.description,
      paymentMethod: formData.paymentMethod,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      location: formData.location || undefined,
      receipt: formData.receipt ? `receipt-${Date.now()}.pdf` : undefined
    };

    setExpenses([...expenses, newExpense]);
    setFormData({ date: '', category: categories[0], amount: '', description: '', paymentMethod: paymentMethods[0], tags: '', location: '', receipt: null });
    toast.success('Expense added successfully!');
  };

  const handleExport = async (template: ExportTemplate, destination: string) => {
    const exportId = Date.now().toString();
    
    const newExport: ExportHistory = {
      id: exportId,
      timestamp: new Date().toISOString(),
      template: template.name,
      destination,
      status: 'processing',
      recordCount: expenses.length
    };
    
    setExportHistory(prev => [newExport, ...prev]);
    toast.loading(`Exporting to ${destination}...`, { id: exportId });

    setTimeout(() => {
      const shareUrl = `https://expense-tracker.app/share/${exportId}`;
      setShareUrl(shareUrl);
      
      setExportHistory(prev => prev.map(exp => 
        exp.id === exportId 
          ? { ...exp, status: 'completed' as const, fileSize: '2.3 KB', shareUrl }
          : exp
      ));
      
      
      toast.success(`Successfully exported to ${destination}!`, { id: exportId });
      
      if (destination === 'Google Sheets') {
        setNotifications(prev => [{
          id: Date.now().toString(),
          message: `${template.name} exported to Google Sheets - ${expenses.length} records`,
          type: 'success',
          timestamp: new Date().toISOString()
        }, ...prev]);
      }
      
      setShowShareModal(true);
    }, 2000);
  };

  const handleScheduleExport = () => {
    toast.success(`Scheduled ${scheduleData.template} export ${scheduleData.frequency} to ${scheduleData.destination}`);
    setScheduleModal(false);
  };

  const connectIntegration = (integrationId: string) => {
    toast.loading('Connecting...', { id: integrationId });
    setTimeout(() => {
      toast.success('Connected successfully!', { id: integrationId });
    }, 1500);
  };

  const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const businessExpenses = expenses.filter(exp => exp.tags.includes('business')).reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <Toaster position="top-right" />
      
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">ExpenseHub</h1>
                <p className="text-sm text-gray-500">Cloud-Integrated Expense Management</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Connected
              </div>
              
              <div className="relative">
                <button className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                  <span className="text-gray-600">🔔</span>
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          <nav className="flex gap-8 mt-4">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: '📊' },
              { id: 'export', label: 'Smart Export', icon: '🚀' },
              { id: 'history', label: 'Export History', icon: '📋' },
              { id: 'integrations', label: 'Integrations', icon: '🔗' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'dashboard' | 'export' | 'history' | 'integrations')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Quick Stats</h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                    <div>
                      <p className="text-sm text-gray-600">Total Expenses</p>
                      <p className="text-2xl font-bold text-gray-900">${totalAmount.toFixed(2)}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <span className="text-2xl">💰</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                    <div>
                      <p className="text-sm text-gray-600">Business Expenses</p>
                      <p className="text-2xl font-bold text-gray-900">${businessExpenses.toFixed(2)}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <span className="text-2xl">🏢</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                    <div>
                      <p className="text-sm text-gray-600">This Month</p>
                      <p className="text-2xl font-bold text-gray-900">{expenses.length}</p>
                      <p className="text-xs text-gray-500">expenses recorded</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <span className="text-2xl">📈</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Add New Expense</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Enter description"
                      required
                    />
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-lg"
                  >
                    Add Expense
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold">Recent Expenses</h2>
                  <button
                    onClick={() => setActiveTab('export')}
                    className="bg-gradient-to-r from-emerald-600 to-green-600 text-white px-6 py-2 rounded-lg hover:from-emerald-700 hover:to-green-700 transition-all duration-200 font-medium shadow-lg flex items-center gap-2"
                  >
                    <span>🚀</span>
                    Smart Export
                  </button>
                </div>
                
                <div className="space-y-3">
                  {expenses.map((expense) => (
                    <div key={expense.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-gray-900">{expense.description}</h3>
                            {expense.receipt && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                📎 Receipt
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>{format(parseISO(expense.date), 'MMM d, yyyy')}</span>
                            <span>{expense.category}</span>
                            <span>{expense.paymentMethod}</span>
                            {expense.location && <span>📍 {expense.location}</span>}
                          </div>
                          {expense.tags.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {expense.tags.map(tag => (
                                <span key={tag} className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-gray-900">${expense.amount.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Smart Export Hub</h2>
              <p className="text-gray-600">Choose from pre-built templates or create custom exports</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {exportTemplates.map(template => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-105"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">{template.icon}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{template.name}</h3>
                    <p className="text-sm text-gray-600 mb-4">{template.description}</p>
                    <div className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                      {template.format}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedTemplate && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">{selectedTemplate.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{selectedTemplate.name}</h3>
                    <p className="text-gray-600">{selectedTemplate.description}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div 
                    onClick={() => handleExport(selectedTemplate, 'Google Sheets')}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-6 hover:border-green-300 hover:bg-green-50 transition-all cursor-pointer"
                  >
                    <div className="text-center">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <span className="text-2xl">📊</span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1">Google Sheets</h4>
                      <p className="text-sm text-gray-600">Live collaboration & real-time sync</p>
                    </div>
                  </div>
                  
                  <div 
                    onClick={() => handleExport(selectedTemplate, 'Email')}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
                  >
                    <div className="text-center">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <span className="text-2xl">📧</span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1">Email Report</h4>
                      <p className="text-sm text-gray-600">Professional formatted report</p>
                    </div>
                  </div>
                  
                  <div 
                    onClick={() => handleExport(selectedTemplate, 'Dropbox')}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-6 hover:border-purple-300 hover:bg-purple-50 transition-all cursor-pointer"
                  >
                    <div className="text-center">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <span className="text-2xl">📦</span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1">Cloud Storage</h4>
                      <p className="text-sm text-gray-600">Automatic backup & sync</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-gray-200 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setScheduleModal(true)}
                      className="px-4 py-2 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      ⏰ Schedule Recurring
                    </button>
                    <button className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      ⚙️ Customize Template
                    </button>
                  </div>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Export History</h2>
              <div className="flex gap-3">
                <select className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>All Status</option>
                  <option>Completed</option>
                  <option>Processing</option>
                  <option>Failed</option>
                </select>
                <select className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>Last 30 days</option>
                  <option>Last 7 days</option>
                  <option>This month</option>
                </select>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-200">
                {exportHistory.map(export_ => (
                  <div key={export_.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${
                          export_.status === 'completed' ? 'bg-green-500' :
                          export_.status === 'processing' ? 'bg-yellow-500 animate-pulse' :
                          export_.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                        }`}></div>
                        <div>
                          <h3 className="font-medium text-gray-900">{export_.template}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                            <span>{format(parseISO(export_.timestamp), 'MMM d, yyyy h:mm a')}</span>
                            <span>→ {export_.destination}</span>
                            <span>{export_.recordCount} records</span>
                            {export_.fileSize && <span>{export_.fileSize}</span>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {export_.status === 'completed' && (
                          <>
                            {export_.shareUrl && (
                              <button
                                onClick={() => {
                                  setShareUrl(export_.shareUrl!);
                                  setShowShareModal(true);
                                }}
                                className="px-3 py-1 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                              >
                                📤 Share
                              </button>
                            )}
                            <button className="px-3 py-1 text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm">
                              📥 Download
                            </button>
                          </>
                        )}
                        {export_.status === 'processing' && (
                          <div className="flex items-center gap-2 text-sm text-yellow-600">
                            <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                            Processing...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Connected Services</h2>
              <p className="text-gray-600">Integrate with your favorite tools and services</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cloudIntegrations.map(integration => (
                <div key={integration.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                        <span className="text-xl">{integration.icon}</span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{integration.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <div className={`w-2 h-2 rounded-full ${
                            integration.status === 'active' ? 'bg-green-500' :
                            integration.status === 'syncing' ? 'bg-yellow-500 animate-pulse' :
                            integration.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                          }`}></div>
                          <span className={`text-xs capitalize ${
                            integration.status === 'active' ? 'text-green-600' :
                            integration.status === 'syncing' ? 'text-yellow-600' :
                            integration.status === 'error' ? 'text-red-600' : 'text-gray-500'
                          }`}>
                            {integration.status === 'syncing' ? 'Syncing...' : integration.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {integration.connected ? (
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                          ⚙️
                        </button>
                        <button className="p-2 text-green-600">
                          ✅
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => connectIntegration(integration.id)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                  
                  {integration.connected && integration.lastSync && (
                    <div className="text-xs text-gray-500">
                      Last sync: {format(parseISO(integration.lastSync), 'MMM d, h:mm a')}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-8 text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Need a Custom Integration?</h3>
              <p className="text-gray-600 mb-4">We can connect to virtually any service via API</p>
              <button className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-medium">
                Request Integration
              </button>
            </div>
          </div>
        )}
      </div>

      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Share Your Export</h3>
              
              <div className="mb-6">
                {qrCodeUrl && (
                  <Image src={qrCodeUrl} alt="QR Code" width={200} height={200} className="mx-auto mb-4" />
                )}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-gray-600 break-all">{shareUrl}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl);
                      toast.success('Link copied to clipboard!');
                    }}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    📋 Copy Link
                  </button>
                  <button className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                    📧 Email
                  </button>
                </div>
              </div>
              
              <button
                onClick={() => setShowShareModal(false)}
                className="w-full px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {scheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Schedule Recurring Export</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
                <select
                  value={scheduleData.template}
                  onChange={(e) => setScheduleData({ ...scheduleData, template: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select template</option>
                  {exportTemplates.map(template => (
                    <option key={template.id} value={template.name}>{template.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                  <select
                    value={scheduleData.frequency}
                    onChange={(e) => setScheduleData({ ...scheduleData, frequency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                  <input
                    type="time"
                    value={scheduleData.time}
                    onChange={(e) => setScheduleData({ ...scheduleData, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
                <select
                  value={scheduleData.destination}
                  onChange={(e) => setScheduleData({ ...scheduleData, destination: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="email">Email</option>
                  <option value="google-sheets">Google Sheets</option>
                  <option value="dropbox">Dropbox</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleScheduleExport}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Schedule Export
              </button>
              <button
                onClick={() => setScheduleModal(false)}
                className="flex-1 px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
