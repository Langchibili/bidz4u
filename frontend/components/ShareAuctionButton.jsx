'use client';

import { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import ShareIcon from '@mui/icons-material/ShareOutlined';
import { apiClient } from '@/lib/api/client';

export default function ShareAuctionButton({ item, sx }) {
  const [copied, setCopied] = useState(false);

  const share = async (event) => {
    event.stopPropagation();
    const url = `${window.location.origin}/auction/${apiClient.resolveId(item)}`;
    const shareData = { title: item?.actTitle || 'Bidz4U auction', url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch (error) {
      if (error?.name !== 'AbortError') console.warn('Could not share auction link', error);
    }
  };

  return (
    <Tooltip title={copied ? 'Link copied' : 'Share auction'}>
      <IconButton aria-label="Share auction" size="small" onClick={share} sx={sx}>
        <ShareIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
