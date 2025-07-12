// frontend/src/components/bills/CreateBillModal.jsx
import React, { useState } from 'react';
import { useCreateBillMutation } from '../services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const CreateBillModal = ({ isOpen, onClose, userId }) => {
  const [createBill, { isLoading }] = useCreateBillMutation();
  
  const [formData, setFormData] = useState({
    title: '',
    total_amount: '',
    bill_date: new Date().toISOString().split('T')[0],
    due_date: '',
    bill_type: 'one_time',
    notes: '',
    is_template: false,
    auto_invite_users: false,
    items: []
  });

  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    quantity: 1,
    unit_price: '',
    total_price: ''
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleItemChange = (field, value) => {
    const updatedItem = { ...newItem, [field]: value };
    
    // Auto-calculate total price
    if (field === 'quantity' || field === 'unit_price') {
      const quantity = field === 'quantity' ? parseFloat(value) || 0 : parseFloat(updatedItem.quantity) || 0;
      const unitPrice = field === 'unit_price' ? parseFloat(value) || 0 : parseFloat(updatedItem.unit_price) || 0;
      updatedItem.total_price = (quantity * unitPrice).toFixed(2);
    }
    
    setNewItem(updatedItem);
  };

  const addItem = () => {
    if (newItem.name && newItem.unit_price) {
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, { ...newItem }]
      }));
      setNewItem({
        name: '',
        description: '',
        quantity: 1,
        unit_price: '',
        total_price: ''
      });
    }
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateTotalFromItems = () => {
    return formData.items.reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0).toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const billData = {
        ...formData,
        created_by: userId,
        total_amount: parseFloat(formData.total_amount)
      };

      await createBill(billData).unwrap();
      toast.success('Bill created successfully!');
      onClose();
    } catch (error) {
      toast.error('Failed to create bill: ' + (error.data?.message || error.message));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Bill</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Bill Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="e.g., Restaurant Dinner"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="total_amount">Total Amount *</Label>
              <Input
                id="total_amount"
                type="number"
                step="0.01"
                value={formData.total_amount}
                onChange={(e) => handleInputChange('total_amount', e.target.value)}
                placeholder="0.00"
                required
              />
              {formData.items.length > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Items total: ${calculateTotalFromItems()}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bill_date">Bill Date *</Label>
              <Input
                id="bill_date"
                type="date"
                value={formData.bill_date}
                onChange={(e) => handleInputChange('bill_date', e.target.value)}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => handleInputChange('due_date', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="bill_type">Bill Type</Label>
            <Select value={formData.bill_type} onValueChange={(value) => handleInputChange('bill_type', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one_time">One-time Bill</SelectItem>
                <SelectItem value="monthly">Monthly Recurring</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_template">Save as Template</Label>
                <p className="text-sm text-gray-500">Save this bill as a template for future use</p>
              </div>
              <Switch
                id="is_template"
                checked={formData.is_template}
                onCheckedChange={(checked) => handleInputChange('is_template', checked)}
              />
            </div>

            {formData.bill_type === 'monthly' && (
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_invite_users">Auto-invite Users</Label>
                  <p className="text-sm text-gray-500">Automatically invite the same users each month</p>
                </div>
                <Switch
                  id="auto_invite_users"
                  checked={formData.auto_invite_users}
                  onCheckedChange={(checked) => handleInputChange('auto_invite_users', checked)}
                />
              </div>
            )}
          </div>

          {/* Bill Items */}
          <div>
            <Label>Bill Items (Optional)</Label>
            <Card className="mt-2">
              <CardContent className="p-4">
                <div className="grid grid-cols-12 gap-2 mb-4">
                  <div className="col-span-3">
                    <Input
                      placeholder="Item name"
                      value={newItem.name}
                      onChange={(e) => handleItemChange('name', e.target.value)}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      placeholder="Description"
                      value={newItem.description}
                      onChange={(e) => handleItemChange('description', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={newItem.quantity}
                      onChange={(e) => handleItemChange('quantity', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Unit price"
                      value={newItem.unit_price}
                      onChange={(e) => handleItemChange('unit_price', e.target.value)}
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Total"
                      value={newItem.total_price}
                      readOnly
                    />
                  </div>
                  <div className="col-span-1">
                    <Button type="button" onClick={addItem} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {formData.items.length > 0 && (
                  <div className="space-y-2">
                    {formData.items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex-1">
                          <span className="font-medium">{item.name}</span>
                          {item.description && <span className="text-gray-500 ml-2">- {item.description}</span>}
                          <div className="text-sm text-gray-500">
                            {item.quantity} × ${item.unit_price} = ${item.total_price}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional notes about this bill..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Bill'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateBillModal;