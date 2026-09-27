'use client';

import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Typography,
} from '@mui/material';
import { apiClient } from '@/lib/api/client';
import { uploadFile } from '@/lib/api/uploads';

export default function ConfirmDeliveryModal({ open, item, onClose, onConfirmed }) {
  const [evidenceId, setEvidenceId] = useState(null);
  const [isDigital, setIsDigital] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const uploadEvidence = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image of the item you received.');
      return;
    }
    try {
      setBusy(true);
      setError('');
      const result = await uploadFile(file, {
        ref: 'api::auction-item.auction-item',
        refId: apiClient.resolveId(item, 'id'),
        field: 'actBuyerDeliveryEvidence',
      });
      const uploadedId = result?.[0]?.id;
      if (!uploadedId) throw new Error('The image upload did not return a file id.');
      setEvidenceId(uploadedId);
    } catch (uploadError) {
      setError(uploadError.message || 'Could not upload the delivery photo.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelivery = async () => {
    if (!isDigital && !evidenceId) return;
    try {
      setBusy(true);
      setError('');
      await apiClient.post(`/auction-items/${encodeURIComponent(apiClient.resolveId(item, 'id'))}/confirm-delivery`, {
        role: 'buyer',
        isDigital,
        evidenceId,
      });
      onConfirmed?.();
      onClose();
    } catch (confirmError) {
      setError(confirmError.message || 'Could not confirm delivery.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="xs">
      <DialogTitle>Confirm item received</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Confirm only after you have received the item. This releases the seller’s escrowed payment.
        </Typography>
        <Button component="label" variant="outlined" fullWidth disabled={busy || isDigital} sx={{ mb: 1.5, minHeight: 48 }}>
          {evidenceId ? 'Photo uploaded' : 'Upload item photo'}
          <input hidden type="file" accept="image/*" onChange={uploadEvidence} />
        </Button>
        {evidenceId && <Alert severity="success" sx={{ mb: 1.5 }}>Delivery photo attached.</Alert>}
        <FormControlLabel
          control={<Checkbox checked={isDigital} onChange={(event) => setIsDigital(event.target.checked)} />}
          label="Item is digital"
        />
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={confirmDelivery} disabled={busy || (!isDigital && !evidenceId)} variant="contained" color="secondary">
          {busy ? 'Please wait…' : 'Confirm reception'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
