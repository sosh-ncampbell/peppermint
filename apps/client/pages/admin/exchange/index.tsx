import { useState, useEffect } from 'react';
import { AdminLayout } from '../../../layouts/adminLayout';
import { Button } from '@/shadcn/ui/button';
import { Input } from '@/shadcn/ui/input';
import { Label } from '@/shadcn/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/shadcn/ui/dialog';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/shadcn/ui/card';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shadcn/ui/table';
import { Badge } from '@/shadcn/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shadcn/ui/dropdown-menu';
import { 
  Alert,
  AlertDescription,
} from '@/shadcn/ui/alert';
import { MoreHorizontal, Plus, RefreshCw, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/router';

interface ExchangeConnection {
  id: string;
  userId: string;
  tenantId: string;
  clientId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ExchangeManagement() {
  const router = useRouter();
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    tenantId: '',
    clientId: ''
  });

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const response = await fetch('/api/v1/exchange/connections', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setConnections(data.connections || []);
      } else {
        throw new Error('Failed to fetch connections');
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
      toast.error('Failed to load Exchange connections');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.tenantId.trim() || !formData.clientId.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/v1/exchange/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('Exchange connection created successfully');
        setCreateDialogOpen(false);
        setFormData({ tenantId: '', clientId: '' });
        fetchConnections();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create connection');
      }
    } catch (error) {
      console.error('Error creating connection:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create connection');
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/exchange/connections/${connectionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Connection deleted successfully');
        fetchConnections();
      } else {
        throw new Error('Failed to delete connection');
      }
    } catch (error) {
      console.error('Error deleting connection:', error);
      toast.error('Failed to delete connection');
    }
  };

  const handleInitiateOAuth = async (connectionId: string) => {
    try {
      const response = await fetch(`/api/v1/exchange/connections/${connectionId}/oauth/initiate`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to initiate OAuth');
      }
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      toast.error('Failed to start authentication');
    }
  };

  const handleTestConnection = async (connectionId: string) => {
    try {
      const response = await fetch(`/api/v1/exchange/connections/${connectionId}/test`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Connection test successful');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Connection test failed');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      toast.error(error instanceof Error ? error.message : 'Connection test failed');
    }
  };

  const handleProcessEmails = async (connectionId: string) => {
    try {
      const response = await fetch(`/api/v1/exchange/connections/${connectionId}/process-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ limit: 50 }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Processed ${data.processed} emails successfully`);
      } else {
        throw new Error('Failed to process emails');
      }
    } catch (error) {
      console.error('Error processing emails:', error);
      toast.error('Failed to process emails');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Exchange Integration</h1>
            <p className="text-muted-foreground">
              Manage Microsoft 365 Exchange connections for automatic ticket creation
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Connection
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Exchange Connection</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateConnection} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tenantId">Tenant ID</Label>
                  <Input
                    id="tenantId"
                    placeholder="Enter Microsoft 365 tenant ID"
                    value={formData.tenantId}
                    onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientId">Client ID</Label>
                  <Input
                    id="clientId"
                    placeholder="Enter Azure application client ID"
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    required
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Create Connection</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Setup Instructions */}
        {connections.length === 0 && (
          <Alert>
            <AlertDescription>
              No Exchange connections configured. Create your first connection to start processing emails from Microsoft 365.
            </AlertDescription>
          </Alert>
        )}

        {/* Connections Table */}
        <Card>
          <CardHeader>
            <CardTitle>Exchange Connections</CardTitle>
            <CardDescription>
              Manage your Microsoft 365 Exchange integrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {connections.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant ID</TableHead>
                    <TableHead>Client ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connections.map((connection) => (
                    <TableRow key={connection.id}>
                      <TableCell className="font-mono text-sm">
                        {connection.tenantId}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {connection.clientId}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={connection.isActive ? "default" : "secondary"}
                        >
                          {connection.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(connection.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleInitiateOAuth(connection.id)}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Authenticate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleTestConnection(connection.id)}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Test Connection
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleProcessEmails(connection.id)}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Process Emails
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteConnection(connection.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No Exchange connections found. Create one to get started.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

ExchangeManagement.getLayout = (page: React.ReactElement) => page;
