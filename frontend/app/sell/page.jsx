// // 'use client'

// // import { Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';
// // import { useRouter, useSearchParams } from 'next/navigation';
// // import {
// //   Box, Typography, TextField, Button, InputAdornment, CircularProgress, Alert,
// //   MenuItem, Skeleton, Stack, Chip,
// // } from '@mui/material';
// // import { useAuth } from '@/lib/contexts/AuthContext';
// // import { apiClient } from '@/lib/api/client';
// // import { uploadFile } from '@/lib/api/uploads';
// // import { STORAGE_KEYS } from '@/Constants';
// // import { getMediaUrl, formatCurrency } from '@/Functions';
// // import DocumentUploadCard from '@/components/shared/DocumentUploadCard';
// // import BottomNav from '@/components/BottomNav';

// // const EXCLUDED_EDIT_STATUSES = ['active', 'sold', 'payment_pending'];

// // /**
// //  * `country.towns` is a plain JSON field — its exact shape isn't pinned down
// //  * by the schema, so this normalizes a few likely shapes into
// //  * { value, label } pairs. Adjust here if your actual data differs.
// //  */
// // function normalizeTowns(rawTowns) {
// //   if (!Array.isArray(rawTowns)) return [];
// //   return rawTowns
// //     .map((t) => {
// //       if (typeof t === 'string') return { value: t, label: t };
// //       if (t && typeof t === 'object') {
// //         const label = t.name || t.townName || t.town || t.label || null;
// //         const value = t.code || label;
// //         return label ? { value, label } : null;
// //       }
// //       return null;
// //     })
// //     .filter(Boolean);
// // }

// // function toDatetimeLocalValue(iso) {
// //   if (!iso) return '';
// //   const d = new Date(iso);
// //   const pad = (n) => String(n).padStart(2, '0');
// //   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
// // }

// // function SellPageInner() {
// //   const router = useRouter();
// //   const searchParams = useSearchParams();
// //   const editDocumentId = searchParams.get('editId');
// //   const { user, countryConfig, hydrated, isAuthenticated } = useAuth();

// //   // 'checking' → resolving what to load; 'creating' → POSTing a brand-new
// //   // draft; 'ready' → form visible; 'error' → something unrecoverable.
// //   const [phase, setPhase] = useState('checking');
// //   const [errorMsg, setErrorMsg] = useState('');
// //   const [isEditMode, setIsEditMode] = useState(false);

// //   const [item, setItem] = useState(null); // the draft OR the listing being edited

// //   const [countries, setCountries] = useState([]);
// //   const [countriesLoading, setCountriesLoading] = useState(true);
// //   const [drafts, setDrafts] = useState([]);

// //   const [title, setTitle] = useState('');
// //   const [description, setDescription] = useState('');
// //   const [startingPrice, setStartingPrice] = useState('');
// //   const [town, setTown] = useState('');
// //   const [selectedCountryId, setSelectedCountryId] = useState('');
// //   const [endDateTime, setEndDateTime] = useState('');

// //   // Minimum starting price for the currently selected country.
// //   const [minStartingPrice, setMinStartingPrice] = useState(null);
// //   const [minStartingPriceCurrency, setMinStartingPriceCurrency] = useState('');

// //   const [publishing, setPublishing] = useState(false);
// //   const [publishError, setPublishError] = useState('');
// //   const [publishSuccess, setPublishSuccess] = useState('');

// //   const pendingChangesRef = useRef({});
// //   const saveTimerRef = useRef(null);

// //   const selectedCountry = useMemo(
// //     () => countries.find((c) => c.id === selectedCountryId) || null,
// //     [countries, selectedCountryId]
// //   );
// //   const towns = useMemo(() => normalizeTowns(selectedCountry?.towns), [selectedCountry]);
// //   const currencyLabel = selectedCountry?.currency?.currSymbol || selectedCountry?.currency?.currCode || '';

// //   // 0, empty, or NaN all mean "no price set" — never send/treat 0 as a real price.
// //   const priceIsUnset = !startingPrice || Number(startingPrice) === 0 || Number.isNaN(Number(startingPrice));
// //   const priceBelowMinimum = !priceIsUnset && minStartingPrice != null && Number(startingPrice) < minStartingPrice;

// //   // Stable primitive to key effects off of — `user` is a new object
// //   // reference on every AuthContext render, which would otherwise cause the
// //   // init effect below to re-fire (and re-evaluate draft ownership) far more
// //   // often than intended.
// //   const userId = apiClient.resolveId(user, 'id');

// //   const loadItemIntoForm = useCallback((entity) => {
// //     setItem(entity);
// //     setTitle(entity.actTitle && entity.actTitle !== 'Untitled' ? entity.actTitle : '');
// //     setDescription(entity.actDescription || '');
// //     // 0 renders as an empty field — the "No price set" helper text below
// //     // takes over from there rather than showing a literal "0".
// //     setStartingPrice(entity.actStartingPriceNative ? String(entity.actStartingPriceNative) : '');
// //     setTown(entity.actTown || '');
// //     setSelectedCountryId(apiClient.resolveId(entity.itemOriginCountry, 'id') || entity.itemOriginCountry || '');
// //     setEndDateTime(toDatetimeLocalValue(entity.actListingTimeEnd));
// //   }, []);

// //   // ── Fetch the minimum starting price for whichever country is selected ──
// //   useEffect(() => {
// //     if (!selectedCountryId) return undefined;
// //     let cancelled = false;
// //     apiClient
// //       .get(`/countries/${selectedCountryId}/effective-settings`)
// //       .then((res) => {
// //         if (cancelled) return;
// //         const settings = res?.settings || res;
// //         setMinStartingPrice(settings?.minimumAuctionStartingPrice ?? null);
// //         setMinStartingPriceCurrency(selectedCountry?.currency?.currCode || '');
// //       })
// //       .catch((err) => {
// //         console.error('Failed to load effective settings for minimum starting price', err);
// //         if (!cancelled) {
// //           setMinStartingPrice(null);
// //           setMinStartingPriceCurrency('');
// //         }
// //       });
// //     return () => { cancelled = true; };
// //     // eslint-disable-next-line react-hooks/exhaustive-deps
// //   }, [selectedCountryId]);

// //   // ── Autosave: accumulate field diffs, flush as one PUT after ~700ms idle ──
// //   const flushChanges = useCallback(async () => {
// //     const changes = pendingChangesRef.current;
// //     pendingChangesRef.current = {};
// //     if (!item || Object.keys(changes).length === 0) return;
// //     try {
// //       await apiClient.put(`/auction-items/${apiClient.resolveId(item)}`, { data: changes });
// //     } catch (err) {
// //       console.error('Autosave failed:', err);
// //     }
// //   }, [item]);

// //   const queueChange = useCallback((field, value) => {
// //     pendingChangesRef.current[field] = value;
// //     if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
// //     saveTimerRef.current = setTimeout(flushChanges, 700);
// //   }, [flushChanges]);

// //   // ── Create a brand-new draft (grays the page out via `phase` while in flight) ──
// //   const createNewDraft = useCallback(async (countryList, ownCountryId) => {
// //     setPhase('creating');
// //     setErrorMsg('');
// //     try {
// //       const defaultCountryId = ownCountryId || countryList[0]?.id;
// //       if (!defaultCountryId) {
// //         throw new Error(
// //           'No countries available to list from — GET /countries likely failed (check the browser console for the actual error; a 403 there usually means the "find" permission on Country isn\'t enabled for the Authenticated role).'
// //         );
// //       }

// //       const now = new Date();
// //       const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);

// //       const res = await apiClient.post('/auction-items', {
// //         data: {
// //           actTitle: 'Untitled',
// //           actDescription: '',
// //           // Always 0 — see the PRICING file-level note. Requires the
// //           // backend's actStartingPriceNative <= 0 check to allow 0 through.
// //           actStartingPriceNative: 0,
// //           actListingTimeStart: now.toISOString(),
// //           actListingTimeEnd: end.toISOString(),
// //           actAuctionStatus: 'scheduled',
// //           actIsDraft: true,
// //           // ⚠️ See the file-level comment — this may be rejected if
// //           // `actImages` enforces "at least one item" as part of `required`.
// //           actImages: [],
// //           itemOriginCountry: defaultCountryId,
// //         },
// //       });
// //       const created = res?.data || res;

// //       localStorage.setItem(STORAGE_KEYS.CURRENT_DRAFT_ID, String(apiClient.resolveId(created, 'id')));
// //       localStorage.setItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID, String(apiClient.resolveId(created)));

// //       loadItemIntoForm(created);
// //       setPhase('ready');
// //     } catch (err) {
// //       setErrorMsg(err.message || 'Failed to create a draft listing');
// //       setPhase('error');
// //     }
// //   }, [loadItemIntoForm]);

// //   // ── Initial resolution: edit mode vs draft mode ──
// //   //
// //   // FIXED: this used to key off `[hydrated]` only. On a client-side (soft)
// //   // navigation to this page, `hydrated` can become true before `user` (from
// //   // AuthContext) has actually resolved. When that happened, the cached-draft
// //   // branch below ran its ownership check with `viewerId` computed from a
// //   // still-null `user`, the mismatch looked like "this draft isn't ours",
// //   // localStorage got wiped, and a brand-new draft got created underneath a
// //   // perfectly good existing one. Now we also wait for `userId` to be
// //   // present before running any of this, so the ownership check always runs
// //   // against the real signed-in user.
// //   useEffect(() => {
// //     if (!hydrated) return undefined;
// //     if (!userId) return undefined; // wait until AuthContext has resolved the user
// //     let cancelled = false;

// //     async function init() {
// //       let countryList = [];
// //       try {
// //         const res = await apiClient.get('/countries?populate=currency&sort=countryName:asc');
// //         countryList = res?.data || [];
// //         if (!cancelled) setCountries(countryList);
// //       } catch (err) {
// //         console.error('Failed to load countries:', err.status, err.message);
// //       } finally {
// //         if (!cancelled) setCountriesLoading(false);
// //       }

// //       if (editDocumentId) {
// //         setIsEditMode(true);
// //         try {
// //           const res = await apiClient.get(
// //             `/auction-items/${editDocumentId}?populate[actImages][populate]=*&populate[itemOriginCountry][populate]=currency&populate[seller][fields][0]=id`
// //           );
// //           const entity = res?.data || res;
// //           const ownerId = apiClient.resolveId(entity.seller, 'id');
// //           const viewerId = apiClient.resolveId(user, 'id');

// //           if (String(ownerId) !== String(viewerId)) {
// //             if (!cancelled) { setErrorMsg("You don't own this listing"); setPhase('error'); }
// //             return;
// //           }
// //           if (EXCLUDED_EDIT_STATUSES.includes(entity.actAuctionStatus)) {
// //             if (!cancelled) {
// //               setErrorMsg('This listing can no longer be edited — it is live, sold, or awaiting a winner\'s payment.');
// //               setPhase('error');
// //             }
// //             return;
// //           }
// //           if (!cancelled) { loadItemIntoForm(entity); setPhase('ready'); }
// //         } catch (err) {
// //           if (!cancelled) { setErrorMsg(err.message || 'Failed to load this listing'); setPhase('error'); }
// //         }
// //         return;
// //       }

// //       // Draft mode
// //       const cachedDocId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID) : null;
// //       if (cachedDocId) {
// //         try {
// //           // FIXED: this used to omit `populate[seller]`, so entity.seller
// //           // was always undefined and the ownership check below always
// //           // failed — meaning a perfectly valid cached draft got wiped and
// //           // recreated on EVERY page load. seller's id is now populated.
// //           const res = await apiClient.get(
// //             `/auction-items/${cachedDocId}?populate[actImages][populate]=*&populate[seller][fields][0]=id`
// //           );
// //           const entity = res?.data || res;
// //           const ownerId = apiClient.resolveId(entity.seller, 'id');
// //           const viewerId = apiClient.resolveId(user, 'id');

// //           if (entity.actIsDraft && String(ownerId) === String(viewerId)) {
// //             if (!cancelled) { loadItemIntoForm(entity); setPhase('ready'); }
// //             return;
// //           }
// //           // Cached draft is gone/no longer a draft/not ours — clear and fall through.
// //           localStorage.removeItem(STORAGE_KEYS.CURRENT_DRAFT_ID);
// //           localStorage.removeItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID);
// //         } catch {
// //           localStorage.removeItem(STORAGE_KEYS.CURRENT_DRAFT_ID);
// //           localStorage.removeItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID);
// //         }
// //       }

// //       if (!cancelled) {
// //         await createNewDraft(countryList, countryConfig?.countryId);
// //       }
// //     }

// //     init();
// //     return () => { cancelled = true; };
// //     // eslint-disable-next-line react-hooks/exhaustive-deps
// //   }, [hydrated, userId]);

// //   // Redirect unauthenticated visitors, matching every other protected page.
// //   useEffect(() => {
// //     if (hydrated && !isAuthenticated()) router.push('/login');
// //   }, [hydrated, isAuthenticated, router]);

// //   // ── Other drafts, for the browser below the form (draft mode only) ──
// //   // FIXED: was GET /auction-items?filters[seller][id][$eq]=... — Strapi
// //   // rejects filtering by relations to plugin::users-permissions.user
// //   // through the plain REST API ("Invalid key seller"). Now uses the custom
// //   // /auction-items/mine endpoint (see the file-level comment + README for
// //   // the required backend addition), filtered to drafts client-side.
// //   useEffect(() => {
// //     if (isEditMode || !user) return;
// //     apiClient
// //       .get('/auction-items/mine')
// //       .then((res) => setDrafts((res?.items || []).filter((i) => i.actIsDraft)))
// //       .catch((err) => console.error('Failed to load drafts:', err.status, err.message));
// //   }, [isEditMode, user, item]);

// //   const switchToDraft = async (draft) => {
// //     const docId = apiClient.resolveId(draft);
// //     const numId = apiClient.resolveId(draft, 'id');
// //     localStorage.setItem(STORAGE_KEYS.CURRENT_DRAFT_ID, String(numId));
// //     localStorage.setItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID, String(docId));
// //     setPhase('checking');
// //     try {
// //       const res = await apiClient.get(`/auction-items/${docId}?populate[actImages][populate]=*`);
// //       loadItemIntoForm(res?.data || res);
// //       setPhase('ready');
// //     } catch (err) {
// //       setErrorMsg(err.message || 'Failed to load that draft');
// //       setPhase('error');
// //     }
// //   };

// //   const handleCreateNewListing = () => {
// //     localStorage.removeItem(STORAGE_KEYS.CURRENT_DRAFT_ID);
// //     localStorage.removeItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID);
// //     setItem(null);
// //     createNewDraft(countries, countryConfig?.countryId);
// //   };

// //   // ── Field handlers ──
// //   const handleTitleChange = (v) => { setTitle(v); queueChange('actTitle', v || 'Untitled'); };
// //   const handleDescriptionChange = (v) => { setDescription(v); queueChange('actDescription', v); };
// //   const handlePriceChange = (v) => {
// //     setStartingPrice(v);
// //     const num = Number(v);
// //     // Autosave 0 too (explicitly "no price set" is a valid saved state for
// //     // a draft) — only skip saving genuinely invalid/NaN input.
// //     if (!Number.isNaN(num) && num >= 0) queueChange('actStartingPriceNative', num);
// //   };
// //   const handleTownChange = (v) => { setTown(v); queueChange('actTown', v); };
// //   const handleCountryChange = (id) => {
// //     setSelectedCountryId(id);
// //     setTown('');
// //     queueChange('itemOriginCountry', id);
// //     // Safeguard — see the CURRENCY NOTE at the top of this file.
// //     const c = countries.find((c) => c.id === id);
// //     if (c?.currency?.currCode) queueChange('actNativeCurrencyCode', c.currency.currCode);
// //   };
// //   const handleEndDateTimeChange = (v) => {
// //     setEndDateTime(v);
// //     if (v) queueChange('actListingTimeEnd', new Date(v).toISOString());
// //   };

// //   const numericItemId = apiClient.resolveId(item, 'id');

// //   const handleImageUpload = async (file) => {
// //     const media = await uploadFile(file, {
// //       ref: 'api::auction-item.auction-item',
// //       refId: numericItemId,
// //       field: 'actImages',
// //     });
// //     setItem((prev) => ({ ...prev, actImages: media }));
// //   };

// //   const handleImageRemove = () => {
// //     // NOTE: only clears local UI state — does not detach the file from the
// //     // entry server-side (no delete-media call here).
// //     setItem((prev) => ({ ...prev, actImages: [] }));
// //   };

// //   const handlePublish = async () => {
// //     setPublishError('');
// //     setPublishSuccess('');

// //     if (!title.trim()) { setPublishError('Give your listing a title'); return; }
// //     if (priceIsUnset) { setPublishError('Set a starting price before publishing — it\'s currently unset'); return; }
// //     if (priceBelowMinimum) {
// //       setPublishError(`Starting price must be at least ${minStartingPriceCurrency}${minStartingPrice}`);
// //       return;
// //     }
// //     if (!item?.actImages?.length) { setPublishError('Add at least one photo'); return; }
// //     if (towns.length > 0 && !town) { setPublishError("Select the town you're listing from"); return; }
// //     if (!endDateTime || new Date(endDateTime) <= new Date()) { setPublishError('Pick an auction end time in the future'); return; }

// //     if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
// //     await flushChanges();

// //     try {
// //       setPublishing(true);
// //       await apiClient.put(`/auction-items/${apiClient.resolveId(item)}`, {
// //         data: {
// //           actIsDraft: false,
// //           actAuctionStatus: 'active',
// //           actListingTimeStart: new Date().toISOString(),
// //           actListingTimeEnd: new Date(endDateTime).toISOString(),
// //         },
// //       });
// //       localStorage.removeItem(STORAGE_KEYS.CURRENT_DRAFT_ID);
// //       localStorage.removeItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID);
// //       setPublishSuccess('Listing published!');
// //       setTimeout(() => router.push('/'), 900);
// //     } catch (err) {
// //       setPublishError(err.message || 'Failed to publish listing');
// //     } finally {
// //       setPublishing(false);
// //     }
// //   };

// //   const handleSaveEdit = async () => {
// //     setPublishError('');
// //     setPublishSuccess('');

// //     if (priceIsUnset) { setPublishError('Set a starting price — it\'s currently unset'); return; }
// //     if (priceBelowMinimum) {
// //       setPublishError(`Starting price must be at least ${minStartingPriceCurrency}${minStartingPrice}`);
// //       return;
// //     }

// //     if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
// //     await flushChanges();
// //     setPublishSuccess('Changes saved.');
// //     setTimeout(() => router.push('/'), 700);
// //   };

// //   // ── Render ──

// //   if (phase === 'checking' || phase === 'creating') {
// //     return (
// //       <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
// //         <Skeleton variant="text" width={200} height={48} />
// //         <Skeleton variant="text" width={280} height={24} sx={{ mb: 3 }} />
// //         <Stack spacing={2}>
// //           <Skeleton variant="rounded" height={56} />
// //           <Skeleton variant="rounded" height={96} />
// //           <Skeleton variant="rounded" height={56} />
// //           <Skeleton variant="rounded" height={56} />
// //           <Skeleton variant="rounded" height={140} />
// //           <Skeleton variant="rounded" height={56} />
// //         </Stack>
// //         {phase === 'creating' && (
// //           <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
// //             Setting up your draft…
// //           </Typography>
// //         )}
// //         <BottomNav />
// //       </Box>
// //     );
// //   }

// //   if (phase === 'error') {
// //     return (
// //       <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
// //         <Alert severity="error" sx={{ borderRadius: 3 }}>{errorMsg}</Alert>
// //         <BottomNav />
// //       </Box>
// //     );
// //   }

// //   const totalDrafts = drafts.length;
// //   const otherDrafts = drafts.filter((d) => apiClient.resolveId(d) !== apiClient.resolveId(item));

// //   const draftsBrowser = !isEditMode && (
// //     <Box sx={{ mt: 4 }}>
// //       <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
// //         Your Drafts
// //       </Typography>

// //       <Stack spacing={1.5}>
// //         {totalDrafts > 2 && (
// //           <Button variant="outlined" onClick={handleCreateNewListing} sx={{ height: 48 }}>
// //             + Create New Auction Listing
// //           </Button>
// //         )}

// //         {otherDrafts.map((d) => {
// //           const thumb = d.actImages?.[0]?.url;
// //           const draftHasPrice = d.actStartingPriceNative > 0;
// //           return (
// //             <Box
// //               key={apiClient.resolveId(d)}
// //               onClick={() => switchToDraft(d)}
// //               sx={{
// //                 display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2.5,
// //                 cursor: 'pointer', bgcolor: 'background.paper',
// //                 boxShadow: '0px 4px 16px rgba(0,0,0,0.35)',
// //               }}
// //             >
// //               <Box
// //                 sx={{
// //                   width: 48, height: 48, borderRadius: 1.5, flexShrink: 0, bgcolor: 'rgba(148,163,184,0.08)',
// //                   backgroundImage: thumb ? `url(${getMediaUrl(thumb)})` : undefined,
// //                   backgroundSize: 'cover', backgroundPosition: 'center',
// //                 }}
// //               />
// //               <Box sx={{ minWidth: 0, flex: 1 }}>
// //                 <Typography variant="body2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
// //                   {d.actTitle && d.actTitle !== 'Untitled' ? d.actTitle : 'Untitled draft'}
// //                 </Typography>
// //                 <Typography variant="caption" color={draftHasPrice ? 'text.secondary' : 'error.main'}>
// //                   {draftHasPrice
// //                     ? formatCurrency(d.actStartingPriceNative, d.actNativeCurrencyCode)
// //                     : 'No price set'}
// //                 </Typography>
// //               </Box>
// //               <Chip size="small" label="Draft" sx={{ height: 20, fontSize: 10 }} />
// //             </Box>
// //           );
// //         })}

// //         {totalDrafts <= 2 && (
// //           <Button variant="outlined" onClick={handleCreateNewListing} sx={{ height: 48 }}>
// //             + Create New Auction Listing
// //           </Button>
// //         )}
// //       </Stack>
// //     </Box>
// //   );

// //   return (
// //     <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
// //       <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
// //         {isEditMode ? 'Edit Listing' : 'Sell an Item'}
// //       </Typography>
// //       <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
// //         {isEditMode
// //           ? 'Changes save automatically as you type.'
// //           : 'Your progress saves automatically — publish whenever you\'re ready.'}
// //       </Typography>

// //       <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
// //         <TextField fullWidth label="Title" value={title} onChange={(e) => handleTitleChange(e.target.value)} />
// //         <TextField
// //           fullWidth
// //           multiline
// //           minRows={3}
// //           label="Description"
// //           value={description}
// //           onChange={(e) => handleDescriptionChange(e.target.value)}
// //         />

// //         <TextField
// //           select
// //           fullWidth
// //           label="Country"
// //           value={selectedCountryId}
// //           onChange={(e) => handleCountryChange(e.target.value)}
// //           disabled={countriesLoading}
// //         >
// //           {countries.map((c) => (
// //             <MenuItem key={c.id} value={c.id}>{c.countryName}</MenuItem>
// //           ))}
// //         </TextField>

// //         <TextField
// //           select
// //           fullWidth
// //           label="Town"
// //           value={town}
// //           onChange={(e) => handleTownChange(e.target.value)}
// //           disabled={countriesLoading || !selectedCountryId}
// //           helperText={
// //             !countriesLoading && towns.length === 0
// //               ? `No towns configured for ${selectedCountry?.countryName || 'this country'} yet`
// //               : undefined
// //           }
// //         >
// //           {towns.map((t) => (
// //             <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
// //           ))}
// //         </TextField>

// //         <TextField
// //           fullWidth
// //           type="number"
// //           label="Starting price"
// //           value={startingPrice}
// //           onChange={(e) => handlePriceChange(e.target.value)}
// //           InputProps={{ startAdornment: <InputAdornment position="start">{currencyLabel}</InputAdornment> }}
// //           error={priceIsUnset || priceBelowMinimum}
// //           helperText={
// //             priceIsUnset
// //               ? 'No price set — this listing cannot be published until you set one'
// //               : priceBelowMinimum
// //                 ? `Below the minimum of ${minStartingPriceCurrency}${minStartingPrice}`
// //                 : selectedCountry
// //                   ? `Priced in ${selectedCountry.countryName}'s currency (${selectedCountry.currency?.currCode || '—'})${minStartingPrice != null ? ` — minimum ${minStartingPriceCurrency}${minStartingPrice}` : ''}`
// //                   : undefined
// //           }
// //         />

// //         <TextField
// //           fullWidth
// //           type="datetime-local"
// //           label="Auction ends at"
// //           value={endDateTime}
// //           onChange={(e) => handleEndDateTimeChange(e.target.value)}
// //           InputLabelProps={{ shrink: true }}
// //         />

// //         <DocumentUploadCard
// //           title="Item photo"
// //           description="A clear photo of the item you're listing"
// //           maxSize={5}
// //           uploadedFile={item?.actImages?.[0] || null}
// //           onUpload={handleImageUpload}
// //           onRemove={handleImageRemove}
// //           disabled={!item}
// //         />

// //         {publishError && <Alert severity="error" sx={{ borderRadius: 3 }}>{publishError}</Alert>}
// //         {publishSuccess && <Alert severity="success" sx={{ borderRadius: 3 }}>{publishSuccess}</Alert>}

// //         <Button
// //           fullWidth
// //           variant="contained"
// //           color="secondary"
// //           size="large"
// //           onClick={isEditMode ? handleSaveEdit : handlePublish}
// //           disabled={publishing}
// //           sx={{ height: 56, fontWeight: 700 }}
// //         >
// //           {publishing ? <CircularProgress size={24} color="inherit" /> : isEditMode ? 'Save Changes' : 'Publish Listing'}
// //         </Button>
// //       </Box>

// //       {draftsBrowser}

// //       <BottomNav />
// //     </Box>
// //   );
// // }

// // export default function SellPage() {
// //   return (
// //     <Suspense fallback={<Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress color="secondary" /></Box>}>
// //       <SellPageInner />
// //     </Suspense>
// //   );
// // }
// 'use client'

// import { Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';
// import { useRouter, useSearchParams } from 'next/navigation';
// import {
//   Box, Typography, TextField, Button, InputAdornment, CircularProgress, Alert,
//   MenuItem, Skeleton, Stack, Chip,
// } from '@mui/material';
// import { useAuth } from '@/lib/contexts/AuthContext';
// import { apiClient } from '@/lib/api/client';
// import { uploadFile } from '@/lib/api/uploads';
// import { STORAGE_KEYS } from '@/Constants';
// import { getMediaUrl, formatCurrency } from '@/Functions';
// import DocumentUploadCard from '@/components/shared/DocumentUploadCard';
// import BottomNav from '@/components/BottomNav';

// const EXCLUDED_EDIT_STATUSES = ['active', 'sold', 'payment_pending'];

// // ── Draft-creation mutex ─────────────────────────────────────────────────
// // Guards against two concurrent "no cached draft found → create one" runs
// // racing each other — e.g. React Strict Mode's dev-mode double effect
// // invoke (mount → cleanup → mount again), or a user double-clicking into
// // Sell before the first draft finishes being created. Both would otherwise
// // read localStorage before either write lands, both see "nothing cached",
// // and both create a draft — the second create's localStorage.setItem then
// // clobbers the first, orphaning it.
// //
// // localStorage (not a React ref) is the right primitive here because it's
// // synchronous and shared across whichever concurrent call sites are racing,
// // not just within a single component instance.
// const DRAFT_CREATION_LOCK_KEY = 'bidz4u_draft_creation_lock';
// const DRAFT_CREATION_LOCK_TTL_MS = 15000; // stale-lock safety net if a prior attempt crashed
// const LOCK_POLL_INTERVAL_MS = 200;
// const LOCK_POLL_MAX_ATTEMPTS = 30; // ~6s total

// function tryAcquireDraftCreationLock() {
//   if (typeof window === 'undefined') return true;
//   const existing = localStorage.getItem(DRAFT_CREATION_LOCK_KEY);
//   if (existing) {
//     const ts = Number(existing);
//     if (!Number.isNaN(ts) && Date.now() - ts < DRAFT_CREATION_LOCK_TTL_MS) {
//       return false; // another in-flight init already owns creation
//     }
//   }
//   localStorage.setItem(DRAFT_CREATION_LOCK_KEY, String(Date.now()));
//   return true;
// }

// function releaseDraftCreationLock() {
//   if (typeof window === 'undefined') return;
//   localStorage.removeItem(DRAFT_CREATION_LOCK_KEY);
// }

// // If someone else holds the lock, wait for them to finish and publish a
// // cached draft id rather than racing them — return that id (or null if it
// // timed out without one appearing, in which case the caller falls back to
// // creating its own).
// async function waitForCachedDraftId() {
//   for (let attempt = 0; attempt < LOCK_POLL_MAX_ATTEMPTS; attempt += 1) {
//     await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_INTERVAL_MS));
//     const docId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID) : null;
//     if (docId) return docId;
//     const stillLocked = typeof window !== 'undefined' ? localStorage.getItem(DRAFT_CREATION_LOCK_KEY) : null;
//     if (!stillLocked) break; // lock released without publishing a draft (errored out) — stop waiting
//   }
//   return typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID) : null;
// }

// /**
//  * `country.towns` is a plain JSON field — its exact shape isn't pinned down
//  * by the schema, so this normalizes a few likely shapes into
//  * { value, label } pairs. Adjust here if your actual data differs.
//  */
// function normalizeTowns(rawTowns) {
//   if (!Array.isArray(rawTowns)) return [];
//   return rawTowns
//     .map((t) => {
//       if (typeof t === 'string') return { value: t, label: t };
//       if (t && typeof t === 'object') {
//         const label = t.name || t.townName || t.town || t.label || null;
//         const value = t.code || label;
//         return label ? { value, label } : null;
//       }
//       return null;
//     })
//     .filter(Boolean);
// }

// function toDatetimeLocalValue(iso) {
//   if (!iso) return '';
//   const d = new Date(iso);
//   const pad = (n) => String(n).padStart(2, '0');
//   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
// }

// function SellPageInner() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const editDocumentId = searchParams.get('editId');
//   const { user, countryConfig, hydrated, isAuthenticated } = useAuth();

//   // 'checking' → resolving what to load; 'creating' → POSTing a brand-new
//   // draft; 'ready' → form visible; 'error' → something unrecoverable.
//   const [phase, setPhase] = useState('checking');
//   const [errorMsg, setErrorMsg] = useState('');
//   const [isEditMode, setIsEditMode] = useState(false);

//   const [item, setItem] = useState(null); // the draft OR the listing being edited

//   const [countries, setCountries] = useState([]);
//   const [countriesLoading, setCountriesLoading] = useState(true);
//   const [drafts, setDrafts] = useState([]);

//   const [title, setTitle] = useState('');
//   const [description, setDescription] = useState('');
//   const [startingPrice, setStartingPrice] = useState('');
//   const [town, setTown] = useState('');
//   const [selectedCountryId, setSelectedCountryId] = useState('');
//   const [endDateTime, setEndDateTime] = useState('');

//   // Minimum starting price for the currently selected country.
//   const [minStartingPrice, setMinStartingPrice] = useState(null);
//   const [minStartingPriceCurrency, setMinStartingPriceCurrency] = useState('');

//   const [publishing, setPublishing] = useState(false);
//   const [publishError, setPublishError] = useState('');
//   const [publishSuccess, setPublishSuccess] = useState('');

//   const pendingChangesRef = useRef({});
//   const saveTimerRef = useRef(null);

//   // Ensures the init effect's async work only actually runs once per
//   // mount — React Strict Mode's dev-only double effect invoke re-runs the
//   // effect body on the same component instance, and this ref (unlike a
//   // local variable inside the effect) survives that.
//   const initLockRef = useRef(false);

//   const selectedCountry = useMemo(
//     () => countries.find((c) => c.id === selectedCountryId) || null,
//     [countries, selectedCountryId]
//   );
//   const towns = useMemo(() => normalizeTowns(selectedCountry?.towns), [selectedCountry]);
//   const currencyLabel = selectedCountry?.currency?.currSymbol || selectedCountry?.currency?.currCode || '';

//   // 0, empty, or NaN all mean "no price set" — never send/treat 0 as a real price.
//   const priceIsUnset = !startingPrice || Number(startingPrice) === 0 || Number.isNaN(Number(startingPrice));
//   const priceBelowMinimum = !priceIsUnset && minStartingPrice != null && Number(startingPrice) < minStartingPrice;

//   // Stable primitive to key effects off of — `user` is a new object
//   // reference on every AuthContext render, which would otherwise cause the
//   // init effect below to re-fire (and re-evaluate draft ownership) far more
//   // often than intended.
//   const userId = apiClient.resolveId(user, 'id');

//   const loadItemIntoForm = useCallback((entity) => {
//     setItem(entity);
//     setTitle(entity.actTitle && entity.actTitle !== 'Untitled' ? entity.actTitle : '');
//     setDescription(entity.actDescription || '');
//     // 0 renders as an empty field — the "No price set" helper text below
//     // takes over from there rather than showing a literal "0".
//     setStartingPrice(entity.actStartingPriceNative ? String(entity.actStartingPriceNative) : '');
//     setTown(entity.actTown || '');
//     setSelectedCountryId(apiClient.resolveId(entity.itemOriginCountry, 'id') || entity.itemOriginCountry || '');
//     setEndDateTime(toDatetimeLocalValue(entity.actListingTimeEnd));
//   }, []);

//   // ── Fetch the minimum starting price for whichever country is selected ──
//   useEffect(() => {
//     if (!selectedCountryId) return undefined;
//     let cancelled = false;
//     apiClient
//       .get(`/countries/${selectedCountryId}/effective-settings`)
//       .then((res) => {
//         if (cancelled) return;
//         const settings = res?.settings || res;
//         setMinStartingPrice(settings?.minimumAuctionStartingPrice ?? null);
//         setMinStartingPriceCurrency(selectedCountry?.currency?.currCode || '');
//       })
//       .catch((err) => {
//         console.error('Failed to load effective settings for minimum starting price', err);
//         if (!cancelled) {
//           setMinStartingPrice(null);
//           setMinStartingPriceCurrency('');
//         }
//       });
//     return () => { cancelled = true; };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [selectedCountryId]);

//   // ── Autosave: accumulate field diffs, flush as one PUT after ~700ms idle ──
//   const flushChanges = useCallback(async () => {
//     const changes = pendingChangesRef.current;
//     pendingChangesRef.current = {};
//     if (!item || Object.keys(changes).length === 0) return;
//     try {
//       await apiClient.put(`/auction-items/${apiClient.resolveId(item)}`, { data: changes });
//     } catch (err) {
//       console.error('Autosave failed:', err);
//     }
//   }, [item]);

//   const queueChange = useCallback((field, value) => {
//     pendingChangesRef.current[field] = value;
//     if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
//     saveTimerRef.current = setTimeout(flushChanges, 700);
//   }, [flushChanges]);

//   // ── Create a brand-new draft (grays the page out via `phase` while in flight) ──
//   const createNewDraft = useCallback(async (countryList, ownCountryId) => {
//     setPhase('creating');
//     setErrorMsg('');
//     try {
//       const defaultCountryId = ownCountryId || countryList[0]?.id;
//       if (!defaultCountryId) {
//         throw new Error(
//           'No countries available to list from — GET /countries likely failed (check the browser console for the actual error; a 403 there usually means the "find" permission on Country isn\'t enabled for the Authenticated role).'
//         );
//       }

//       const now = new Date();
//       const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);

//       const res = await apiClient.post('/auction-items', {
//         data: {
//           actTitle: 'Untitled',
//           actDescription: '',
//           // Always 0 — see the PRICING file-level note. Requires the
//           // backend's actStartingPriceNative <= 0 check to allow 0 through.
//           actStartingPriceNative: 0,
//           actListingTimeStart: now.toISOString(),
//           actListingTimeEnd: end.toISOString(),
//           actAuctionStatus: 'scheduled',
//           actIsDraft: true,
//           // ⚠️ See the file-level comment — this may be rejected if
//           // `actImages` enforces "at least one item" as part of `required`.
//           actImages: [],
//           itemOriginCountry: defaultCountryId,
//         },
//       });
//       const created = res?.data || res;

//       localStorage.setItem(STORAGE_KEYS.CURRENT_DRAFT_ID, String(apiClient.resolveId(created, 'id')));
//       localStorage.setItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID, String(apiClient.resolveId(created)));

//       loadItemIntoForm(created);
//       setPhase('ready');
//     } catch (err) {
//       setErrorMsg(err.message || 'Failed to create a draft listing');
//       setPhase('error');
//     }
//   }, [loadItemIntoForm]);

//   // ── Initial resolution: edit mode vs draft mode ──
//   useEffect(() => {
//     if (!hydrated) return undefined;
//     if (!userId) return undefined; // wait until AuthContext has resolved the user
//     if (initLockRef.current) return undefined; // already ran for this mount — see comment on the ref
//     initLockRef.current = true;

//     let cancelled = false;

//     async function init() {
//       let countryList = [];
//       try {
//         const res = await apiClient.get('/countries?populate=currency&sort=countryName:asc');
//         countryList = res?.data || [];
//         if (!cancelled) setCountries(countryList);
//       } catch (err) {
//         console.error('Failed to load countries:', err.status, err.message);
//       } finally {
//         if (!cancelled) setCountriesLoading(false);
//       }

//       if (editDocumentId) {
//         setIsEditMode(true);
//         try {
//           const res = await apiClient.get(
//             `/auction-items/${editDocumentId}?populate[actImages][populate]=*&populate[itemOriginCountry][populate]=currency&populate[seller][fields][0]=id`
//           );
//           const entity = res?.data || res;
//           const ownerId = apiClient.resolveId(entity.seller, 'id');
//           const viewerId = apiClient.resolveId(user, 'id');

//           if (String(ownerId) !== String(viewerId)) {
//             if (!cancelled) { setErrorMsg("You don't own this listing"); setPhase('error'); }
//             return;
//           }
//           if (EXCLUDED_EDIT_STATUSES.includes(entity.actAuctionStatus)) {
//             if (!cancelled) {
//               setErrorMsg('This listing can no longer be edited — it is live, sold, or awaiting a winner\'s payment.');
//               setPhase('error');
//             }
//             return;
//           }
//           if (!cancelled) { loadItemIntoForm(entity); setPhase('ready'); }
//         } catch (err) {
//           if (!cancelled) { setErrorMsg(err.message || 'Failed to load this listing'); setPhase('error'); }
//         }
//         return;
//       }

//       // Draft mode
//       const cachedDocId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID) : null;
//       if (cachedDocId) {
//         try {
//           // FIXED: this used to omit `populate[seller]`, so entity.seller
//           // was always undefined and the ownership check below always
//           // failed — meaning a perfectly valid cached draft got wiped and
//           // recreated on EVERY page load. seller's id is now populated.
//           const res = await apiClient.get(
//             `/auction-items/${cachedDocId}?populate[actImages][populate]=*&populate[seller][fields][0]=id`
//           );
//           const entity = res?.data || res;
//           const ownerId = apiClient.resolveId(entity.seller, 'id');
//           const viewerId = apiClient.resolveId(user, 'id');

//           if (entity.actIsDraft && String(ownerId) === String(viewerId)) {
//             if (!cancelled) { loadItemIntoForm(entity); setPhase('ready'); }
//             return;
//           }
//           // Cached draft is gone/no longer a draft/not ours — clear and fall through.
//           localStorage.removeItem(STORAGE_KEYS.CURRENT_DRAFT_ID);
//           localStorage.removeItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID);
//         } catch {
//           localStorage.removeItem(STORAGE_KEYS.CURRENT_DRAFT_ID);
//           localStorage.removeItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID);
//         }
//       }

//       // No usable cached draft. Before creating one, claim the creation
//       // lock — if another concurrent init (Strict Mode double-invoke, a
//       // fast double-click into Sell, etc.) already grabbed it, wait for
//       // that one to publish a draft id instead of racing it.
//       if (!tryAcquireDraftCreationLock()) {
//         const publishedDocId = await waitForCachedDraftId();
//         if (cancelled) return;
//         if (publishedDocId) {
//           try {
//             const res = await apiClient.get(`/auction-items/${publishedDocId}?populate[actImages][populate]=*`);
//             if (!cancelled) { loadItemIntoForm(res?.data || res); setPhase('ready'); }
//           } catch (err) {
//             if (!cancelled) { setErrorMsg(err.message || 'Failed to load your draft'); setPhase('error'); }
//           }
//           return;
//         }
//         // Timed out with nothing published (the other attempt likely
//         // errored out and released its lock) — fall through and try
//         // claiming the lock ourselves.
//         if (!tryAcquireDraftCreationLock()) {
//           if (!cancelled) { setErrorMsg('Failed to create a draft listing — please try again'); setPhase('error'); }
//           return;
//         }
//       }

//       try {
//         if (!cancelled) {
//           await createNewDraft(countryList, countryConfig?.countryId);
//         }
//       } finally {
//         releaseDraftCreationLock();
//       }
//     }

//     init();
//     return () => { cancelled = true; };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [hydrated, userId]);

//   // Redirect unauthenticated visitors, matching every other protected page.
//   useEffect(() => {
//     if (hydrated && !isAuthenticated()) router.push('/login');
//   }, [hydrated, isAuthenticated, router]);

//   // ── Other drafts, for the browser below the form (draft mode only) ──
//   // FIXED: was GET /auction-items?filters[seller][id][$eq]=... — Strapi
//   // rejects filtering by relations to plugin::users-permissions.user
//   // through the plain REST API ("Invalid key seller"). Now uses the custom
//   // /auction-items/mine endpoint (see the file-level comment + README for
//   // the required backend addition), filtered to drafts client-side.
//   useEffect(() => {
//     if (isEditMode || !user) return;
//     apiClient
//       .get('/auction-items/mine')
//       .then((res) => setDrafts((res?.items || []).filter((i) => i.actIsDraft)))
//       .catch((err) => console.error('Failed to load drafts:', err.status, err.message));
//   }, [isEditMode, user, item]);

//   const switchToDraft = async (draft) => {
//     const docId = apiClient.resolveId(draft);
//     const numId = apiClient.resolveId(draft, 'id');
//     localStorage.setItem(STORAGE_KEYS.CURRENT_DRAFT_ID, String(numId));
//     localStorage.setItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID, String(docId));
//     setPhase('checking');
//     try {
//       const res = await apiClient.get(`/auction-items/${docId}?populate[actImages][populate]=*`);
//       loadItemIntoForm(res?.data || res);
//       setPhase('ready');
//     } catch (err) {
//       setErrorMsg(err.message || 'Failed to load that draft');
//       setPhase('error');
//     }
//   };

//   const handleCreateNewListing = () => {
//     localStorage.removeItem(STORAGE_KEYS.CURRENT_DRAFT_ID);
//     localStorage.removeItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID);
//     setItem(null);
//     createNewDraft(countries, countryConfig?.countryId);
//   };

//   // ── Field handlers ──
//   const handleTitleChange = (v) => { setTitle(v); queueChange('actTitle', v || 'Untitled'); };
//   const handleDescriptionChange = (v) => { setDescription(v); queueChange('actDescription', v); };
//   const handlePriceChange = (v) => {
//     setStartingPrice(v);
//     const num = Number(v);
//     // Autosave 0 too (explicitly "no price set" is a valid saved state for
//     // a draft) — only skip saving genuinely invalid/NaN input.
//     if (!Number.isNaN(num) && num >= 0) queueChange('actStartingPriceNative', num);
//   };
//   const handleTownChange = (v) => { setTown(v); queueChange('actTown', v); };
//   const handleCountryChange = (id) => {
//     setSelectedCountryId(id);
//     setTown('');
//     queueChange('itemOriginCountry', id);
//     // Safeguard — see the CURRENCY NOTE at the top of this file.
//     const c = countries.find((c) => c.id === id);
//     if (c?.currency?.currCode) queueChange('actNativeCurrencyCode', c.currency.currCode);
//   };
//   const handleEndDateTimeChange = (v) => {
//     setEndDateTime(v);
//     if (v) queueChange('actListingTimeEnd', new Date(v).toISOString());
//   };

//   const numericItemId = apiClient.resolveId(item, 'id');

//   const handleImageUpload = async (file) => {
//     const media = await uploadFile(file, {
//       ref: 'api::auction-item.auction-item',
//       refId: numericItemId,
//       field: 'actImages',
//     });
//     setItem((prev) => ({ ...prev, actImages: media }));
//   };

//   const handleImageRemove = () => {
//     // NOTE: only clears local UI state — does not detach the file from the
//     // entry server-side (no delete-media call here).
//     setItem((prev) => ({ ...prev, actImages: [] }));
//   };

//   const handlePublish = async () => {
//     setPublishError('');
//     setPublishSuccess('');

//     if (!title.trim()) { setPublishError('Give your listing a title'); return; }
//     if (priceIsUnset) { setPublishError('Set a starting price before publishing — it\'s currently unset'); return; }
//     if (priceBelowMinimum) {
//       setPublishError(`Starting price must be at least ${minStartingPriceCurrency}${minStartingPrice}`);
//       return;
//     }
//     if (!item?.actImages?.length) { setPublishError('Add at least one photo'); return; }
//     if (towns.length > 0 && !town) { setPublishError("Select the town you're listing from"); return; }
//     if (!endDateTime || new Date(endDateTime) <= new Date()) { setPublishError('Pick an auction end time in the future'); return; }

//     if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
//     await flushChanges();

//     try {
//       setPublishing(true);
//       await apiClient.put(`/auction-items/${apiClient.resolveId(item)}`, {
//         data: {
//           actIsDraft: false,
//           actAuctionStatus: 'active',
//           actListingTimeStart: new Date().toISOString(),
//           actListingTimeEnd: new Date(endDateTime).toISOString(),
//         },
//       });
//       localStorage.removeItem(STORAGE_KEYS.CURRENT_DRAFT_ID);
//       localStorage.removeItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID);
//       setPublishSuccess('Listing published!');
//       setTimeout(() => router.push('/'), 900);
//     } catch (err) {
//       setPublishError(err.message || 'Failed to publish listing');
//     } finally {
//       setPublishing(false);
//     }
//   };

//   const handleSaveEdit = async () => {
//     setPublishError('');
//     setPublishSuccess('');

//     if (priceIsUnset) { setPublishError('Set a starting price — it\'s currently unset'); return; }
//     if (priceBelowMinimum) {
//       setPublishError(`Starting price must be at least ${minStartingPriceCurrency}${minStartingPrice}`);
//       return;
//     }

//     if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
//     await flushChanges();
//     setPublishSuccess('Changes saved.');
//     setTimeout(() => router.push('/'), 700);
//   };

//   // ── Render ──

//   if (phase === 'checking' || phase === 'creating') {
//     return (
//       <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
//         <Skeleton variant="text" width={200} height={48} />
//         <Skeleton variant="text" width={280} height={24} sx={{ mb: 3 }} />
//         <Stack spacing={2}>
//           <Skeleton variant="rounded" height={56} />
//           <Skeleton variant="rounded" height={96} />
//           <Skeleton variant="rounded" height={56} />
//           <Skeleton variant="rounded" height={56} />
//           <Skeleton variant="rounded" height={140} />
//           <Skeleton variant="rounded" height={56} />
//         </Stack>
//         {phase === 'creating' && (
//           <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
//             Setting up your draft…
//           </Typography>
//         )}
//         <BottomNav />
//       </Box>
//     );
//   }

//   if (phase === 'error') {
//     return (
//       <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
//         <Alert severity="error" sx={{ borderRadius: 3 }}>{errorMsg}</Alert>
//         <BottomNav />
//       </Box>
//     );
//   }

//   const totalDrafts = drafts.length;
//   const otherDrafts = drafts.filter((d) => apiClient.resolveId(d) !== apiClient.resolveId(item));

//   const draftsBrowser = !isEditMode && (
//     <Box sx={{ mt: 4 }}>
//       <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
//         Your Drafts
//       </Typography>

//       <Stack spacing={1.5}>
//         {totalDrafts > 2 && (
//           <Button variant="outlined" onClick={handleCreateNewListing} sx={{ height: 48 }}>
//             + Create New Auction Listing
//           </Button>
//         )}

//         {otherDrafts.map((d) => {
//           const thumb = d.actImages?.[0]?.url;
//           const draftHasPrice = d.actStartingPriceNative > 0;
//           return (
//             <Box
//               key={apiClient.resolveId(d)}
//               onClick={() => switchToDraft(d)}
//               sx={{
//                 display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2.5,
//                 cursor: 'pointer', bgcolor: 'background.paper',
//                 boxShadow: '0px 4px 16px rgba(0,0,0,0.35)',
//               }}
//             >
//               <Box
//                 sx={{
//                   width: 48, height: 48, borderRadius: 1.5, flexShrink: 0, bgcolor: 'rgba(148,163,184,0.08)',
//                   backgroundImage: thumb ? `url(${getMediaUrl(thumb)})` : undefined,
//                   backgroundSize: 'cover', backgroundPosition: 'center',
//                 }}
//               />
//               <Box sx={{ minWidth: 0, flex: 1 }}>
//                 <Typography variant="body2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
//                   {d.actTitle && d.actTitle !== 'Untitled' ? d.actTitle : 'Untitled draft'}
//                 </Typography>
//                 <Typography variant="caption" color={draftHasPrice ? 'text.secondary' : 'error.main'}>
//                   {draftHasPrice
//                     ? formatCurrency(d.actStartingPriceNative, d.actNativeCurrencyCode)
//                     : 'No price set'}
//                 </Typography>
//               </Box>
//               <Chip size="small" label="Draft" sx={{ height: 20, fontSize: 10 }} />
//             </Box>
//           );
//         })}

//         {totalDrafts <= 2 && (
//           <Button variant="outlined" onClick={handleCreateNewListing} sx={{ height: 48 }}>
//             + Create New Auction Listing
//           </Button>
//         )}
//       </Stack>
//     </Box>
//   );

//   return (
//     <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
//       <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
//         {isEditMode ? 'Edit Listing' : 'Sell an Item'}
//       </Typography>
//       <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
//         {isEditMode
//           ? 'Changes save automatically as you type.'
//           : 'Your progress saves automatically — publish whenever you\'re ready.'}
//       </Typography>

//       <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
//         <TextField fullWidth label="Title" value={title} onChange={(e) => handleTitleChange(e.target.value)} />
//         <TextField
//           fullWidth
//           multiline
//           minRows={3}
//           label="Description"
//           value={description}
//           onChange={(e) => handleDescriptionChange(e.target.value)}
//         />

//         <TextField
//           select
//           fullWidth
//           label="Country"
//           value={selectedCountryId}
//           onChange={(e) => handleCountryChange(e.target.value)}
//           disabled={countriesLoading}
//         >
//           {countries.map((c) => (
//             <MenuItem key={c.id} value={c.id}>{c.countryName}</MenuItem>
//           ))}
//         </TextField>

//         <TextField
//           select
//           fullWidth
//           label="Town"
//           value={town}
//           onChange={(e) => handleTownChange(e.target.value)}
//           disabled={countriesLoading || !selectedCountryId}
//           helperText={
//             !countriesLoading && towns.length === 0
//               ? `No towns configured for ${selectedCountry?.countryName || 'this country'} yet`
//               : undefined
//           }
//         >
//           {towns.map((t) => (
//             <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
//           ))}
//         </TextField>

//         <TextField
//           fullWidth
//           type="number"
//           label="Starting price"
//           value={startingPrice}
//           onChange={(e) => handlePriceChange(e.target.value)}
//           InputProps={{ startAdornment: <InputAdornment position="start">{currencyLabel}</InputAdornment> }}
//           error={priceIsUnset || priceBelowMinimum}
//           helperText={
//             priceIsUnset
//               ? 'No price set — this listing cannot be published until you set one'
//               : priceBelowMinimum
//                 ? `Below the minimum of ${minStartingPriceCurrency}${minStartingPrice}`
//                 : selectedCountry
//                   ? `Priced in ${selectedCountry.countryName}'s currency (${selectedCountry.currency?.currCode || '—'})${minStartingPrice != null ? ` — minimum ${minStartingPriceCurrency}${minStartingPrice}` : ''}`
//                   : undefined
//           }
//         />

//         <TextField
//           fullWidth
//           type="datetime-local"
//           label="Auction ends at"
//           value={endDateTime}
//           onChange={(e) => handleEndDateTimeChange(e.target.value)}
//           InputLabelProps={{ shrink: true }}
//         />

//         <DocumentUploadCard
//           title="Item photo"
//           description="A clear photo of the item you're listing"
//           maxSize={5}
//           uploadedFile={item?.actImages?.[0] || null}
//           onUpload={handleImageUpload}
//           onRemove={handleImageRemove}
//           disabled={!item}
//         />

//         {publishError && <Alert severity="error" sx={{ borderRadius: 3 }}>{publishError}</Alert>}
//         {publishSuccess && <Alert severity="success" sx={{ borderRadius: 3 }}>{publishSuccess}</Alert>}

//         <Button
//           fullWidth
//           variant="contained"
//           color="secondary"
//           size="large"
//           onClick={isEditMode ? handleSaveEdit : handlePublish}
//           disabled={publishing}
//           sx={{ height: 56, fontWeight: 700 }}
//         >
//           {publishing ? <CircularProgress size={24} color="inherit" /> : isEditMode ? 'Save Changes' : 'Publish Listing'}
//         </Button>
//       </Box>

//       {draftsBrowser}

//       <BottomNav />
//     </Box>
//   );
// }

// export default function SellPage() {
//   return (
//     <Suspense fallback={<Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress color="secondary" /></Box>}>
//       <SellPageInner />
//     </Suspense>
//   );
// }
'use client'

import { Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box, Typography, TextField, Button, InputAdornment, CircularProgress, Alert,
  MenuItem, Skeleton, Stack, Chip,
} from '@mui/material';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import { uploadFile } from '@/lib/api/uploads';
import { STORAGE_KEYS } from '@/Constants';
import { getMediaUrl, formatCurrency } from '@/Functions';
import DocumentUploadCard from '@/components/shared/DocumentUploadCard';
import BottomNav from '@/components/BottomNav';

const EXCLUDED_EDIT_STATUSES = ['active', 'sold', 'payment_pending'];

// ── Draft-creation mutex ─────────────────────────────────────────────────
// Guards against two concurrent "no cached draft found → create one" runs
// racing each other — e.g. React Strict Mode's dev-mode double effect
// invoke (mount → cleanup → mount again), or a user double-clicking into
// Sell before the first draft finishes being created. Both would otherwise
// read localStorage before either write lands, both see "nothing cached",
// and both create a draft — the second create's localStorage.setItem then
// clobbers the first, orphaning it.
//
// localStorage (not a React ref) is the right primitive here because it's
// synchronous and shared across whichever concurrent call sites are racing,
// not just within a single component instance.
const DRAFT_CREATION_LOCK_KEY = 'bidz4u_draft_creation_lock';
const DRAFT_CREATION_LOCK_TTL_MS = 15000; // stale-lock safety net if a prior attempt crashed
const LOCK_POLL_INTERVAL_MS = 200;
const LOCK_POLL_MAX_ATTEMPTS = 30; // ~6s total

function tryAcquireDraftCreationLock() {
  if (typeof window === 'undefined') return true;
  const existing = localStorage.getItem(DRAFT_CREATION_LOCK_KEY);
  if (existing) {
    const ts = Number(existing);
    if (!Number.isNaN(ts) && Date.now() - ts < DRAFT_CREATION_LOCK_TTL_MS) {
      return false; // another in-flight init already owns creation
    }
  }
  localStorage.setItem(DRAFT_CREATION_LOCK_KEY, String(Date.now()));
  return true;
}

function releaseDraftCreationLock() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DRAFT_CREATION_LOCK_KEY);
}

// If someone else holds the lock, wait for them to finish and publish a
// cached draft id rather than racing them — return that id (or null if it
// timed out without one appearing, in which case the caller falls back to
// creating its own).
async function waitForCachedDraftId() {
  for (let attempt = 0; attempt < LOCK_POLL_MAX_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_INTERVAL_MS));
    const docId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID) : null;
    if (docId) return docId;
    const stillLocked = typeof window !== 'undefined' ? localStorage.getItem(DRAFT_CREATION_LOCK_KEY) : null;
    if (!stillLocked) break; // lock released without publishing a draft (errored out) — stop waiting
  }
  return typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID) : null;
}

/**
 * `country.towns` is a plain JSON field — its exact shape isn't pinned down
 * by the schema, so this normalizes a few likely shapes into
 * { value, label } pairs. Adjust here if your actual data differs.
 */
function normalizeTowns(rawTowns) {
  if (!Array.isArray(rawTowns)) return [];
  return rawTowns
    .map((t) => {
      if (typeof t === 'string') return { value: t, label: t };
      if (t && typeof t === 'object') {
        const label = t.name || t.townName || t.town || t.label || null;
        const value = t.code || label;
        return label ? { value, label } : null;
      }
      return null;
    })
    .filter(Boolean);
}

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SellPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editDocumentId = searchParams.get('editId');
  const { user, countryConfig, hydrated, isAuthenticated } = useAuth();

  // 'checking' → resolving what to load; 'creating' → POSTing a brand-new
  // draft; 'ready' → form visible; 'error' → something unrecoverable.
  const [phase, setPhase] = useState('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  const [item, setItem] = useState(null); // the draft OR the listing being edited

  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [drafts, setDrafts] = useState([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [town, setTown] = useState('');
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [endDateTime, setEndDateTime] = useState('');

  // Minimum starting price for the currently selected country.
  const [minStartingPrice, setMinStartingPrice] = useState(null);
  const [minStartingPriceCurrency, setMinStartingPriceCurrency] = useState('');

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishSuccess, setPublishSuccess] = useState('');

  const pendingChangesRef = useRef({});
  const saveTimerRef = useRef(null);

  // Ensures the init effect's async work only actually runs once per
  // mount — React Strict Mode's dev-only double effect invoke re-runs the
  // effect body on the same component instance, and this ref (unlike a
  // local variable inside the effect) survives that.
  const initLockRef = useRef(false);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.id === selectedCountryId) || null,
    [countries, selectedCountryId]
  );
  const towns = useMemo(() => normalizeTowns(selectedCountry?.towns), [selectedCountry]);
  const currencyLabel = selectedCountry?.currency?.currSymbol || selectedCountry?.currency?.currCode || '';

  // 0, empty, or NaN all mean "no price set" — never send/treat 0 as a real price.
  const priceIsUnset = !startingPrice || Number(startingPrice) === 0 || Number.isNaN(Number(startingPrice));
  const priceBelowMinimum = !priceIsUnset && minStartingPrice != null && Number(startingPrice) < minStartingPrice;

  // Stable primitive to key effects off of — `user` is a new object
  // reference on every AuthContext render, which would otherwise cause the
  // init effect below to re-fire (and re-evaluate draft ownership) far more
  // often than intended.
  const userId = apiClient.resolveId(user, 'id');

  const loadItemIntoForm = useCallback((entity) => {
    setItem(entity);
    setTitle(entity.actTitle && entity.actTitle !== 'Untitled' ? entity.actTitle : '');
    setDescription(entity.actDescription || '');
    // 0 renders as an empty field — the "No price set" helper text below
    // takes over from there rather than showing a literal "0".
    setStartingPrice(entity.actStartingPriceNative ? String(entity.actStartingPriceNative) : '');
    setTown(entity.actTown || '');
    setSelectedCountryId(apiClient.resolveId(entity.itemOriginCountry, 'id') || entity.itemOriginCountry || '');
    setEndDateTime(toDatetimeLocalValue(entity.actListingTimeEnd));
  }, []);

  // Fetch and load a specific existing draft by id, given its numeric or
  // document id — used both by switchToDraft() and by the "backend already
  // has a draft for you" recovery path in createNewDraft() below.
  const loadExistingDraftById = useCallback(async (idForUrl) => {
    const res = await apiClient.get(`/auction-items/${idForUrl}?populate[actImages][populate]=*`);
    const entity = res?.data || res;
    localStorage.setItem(STORAGE_KEYS.CURRENT_DRAFT_ID, String(apiClient.resolveId(entity, 'id')));
    localStorage.setItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID, String(apiClient.resolveId(entity)));
    loadItemIntoForm(entity);
  }, [loadItemIntoForm]);

  // ── Fetch the minimum starting price for whichever country is selected ──
  useEffect(() => {
    if (!selectedCountryId) return undefined;
    let cancelled = false;
    apiClient
      .get(`/countries/${selectedCountryId}/effective-settings`)
      .then((res) => {
        if (cancelled) return;
        const settings = res?.settings || res;
        setMinStartingPrice(settings?.minimumAuctionStartingPrice ?? null);
        setMinStartingPriceCurrency(selectedCountry?.currency?.currCode || '');
      })
      .catch((err) => {
        console.error('Failed to load effective settings for minimum starting price', err);
        if (!cancelled) {
          setMinStartingPrice(null);
          setMinStartingPriceCurrency('');
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountryId]);

  // ── Autosave: accumulate field diffs, flush as one PUT after ~700ms idle ──
  const flushChanges = useCallback(async () => {
    const changes = pendingChangesRef.current;
    pendingChangesRef.current = {};
    if (!item || Object.keys(changes).length === 0) return;
    try {
      await apiClient.put(`/auction-items/${apiClient.resolveId(item)}`, { data: changes });
    } catch (err) {
      console.error('Autosave failed:', err);
    }
  }, [item]);

  const queueChange = useCallback((field, value) => {
    pendingChangesRef.current[field] = value;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushChanges, 700);
  }, [flushChanges]);

  // ── Create a brand-new draft (grays the page out via `phase` while in flight) ──
  //
  // If the backend's beforeCreate lifecycle rejects this because the seller
  // already has a draft in progress (ApplicationError with
  // details.existingDraftId — see the auction-item lifecycle), this does
  // NOT surface an error to the user. It silently loads that existing
  // draft instead and treats it exactly like the normal
  // cached-draft-in-localStorage path: the form just opens on it.
  const createNewDraft = useCallback(async (countryList, ownCountryId) => {
    setPhase('creating');
    setErrorMsg('');
    try {
      const defaultCountryId = ownCountryId || countryList[0]?.id;
      if (!defaultCountryId) {
        throw new Error(
          'No countries available to list from — GET /countries likely failed (check the browser console for the actual error; a 403 there usually means the "find" permission on Country isn\'t enabled for the Authenticated role).'
        );
      }

      const now = new Date();
      const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const res = await apiClient.post('/auction-items', {
        data: {
          actTitle: 'Untitled',
          actDescription: '',
          // Always 0 — see the PRICING file-level note. Requires the
          // backend's actStartingPriceNative <= 0 check to allow 0 through.
          actStartingPriceNative: 0,
          actListingTimeStart: now.toISOString(),
          actListingTimeEnd: end.toISOString(),
          actAuctionStatus: 'scheduled',
          actIsDraft: true,
          // ⚠️ See the file-level comment — this may be rejected if
          // `actImages` enforces "at least one item" as part of `required`.
          actImages: [],
          itemOriginCountry: defaultCountryId,
        },
      });
      const created = res?.data || res;

      localStorage.setItem(STORAGE_KEYS.CURRENT_DRAFT_ID, String(apiClient.resolveId(created, 'id')));
      localStorage.setItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID, String(apiClient.resolveId(created)));

      loadItemIntoForm(created);
      setPhase('ready');
    } catch (err) {
      // The backend's auction-item beforeCreate lifecycle blocks a second
      // draft when the seller's latest listing is already a draft, and
      // returns the existing draft's id via ctx.badRequest(message,
      // { existingDraftId }). That id lands here as
      // err.payload.error.details.existingDraftId. When present, this is
      // NOT a real error from the user's point of view — they just already
      // have a draft — so load it instead of showing errorMsg/phase='error'.
      const existingDraftId = err.payload?.error?.details?.existingDraftId;
      if (existingDraftId) {
        try {
          await loadExistingDraftById(existingDraftId);
          setPhase('ready');
          return;
        } catch (loadErr) {
          setErrorMsg(loadErr.message || 'Failed to load your existing draft');
          setPhase('error');
          return;
        }
      }

      setErrorMsg(err.message || 'Failed to create a draft listing');
      setPhase('error');
    }
  }, [loadItemIntoForm, loadExistingDraftById]);

  // ── Initial resolution: edit mode vs draft mode ──
  useEffect(() => {
    if (!hydrated) return undefined;
    if (!userId) return undefined; // wait until AuthContext has resolved the user
    if (initLockRef.current) return undefined; // already ran for this mount — see comment on the ref
    initLockRef.current = true;

    let cancelled = false;

    async function init() {
      let countryList = [];
      try {
        const res = await apiClient.get('/countries?populate=currency&sort=countryName:asc');
        countryList = res?.data || [];
        if (!cancelled) setCountries(countryList);
      } catch (err) {
        console.error('Failed to load countries:', err.status, err.message);
      } finally {
        if (!cancelled) setCountriesLoading(false);
      }

      if (editDocumentId) {
        setIsEditMode(true);
        try {
          const res = await apiClient.get(
            `/auction-items/${editDocumentId}?populate[actImages][populate]=*&populate[itemOriginCountry][populate]=currency&populate[seller][fields][0]=id`
          );
          const entity = res?.data || res;
          const ownerId = apiClient.resolveId(entity.seller, 'id');
          const viewerId = apiClient.resolveId(user, 'id');

          if (String(ownerId) !== String(viewerId)) {
            if (!cancelled) { setErrorMsg("You don't own this listing"); setPhase('error'); }
            return;
          }
          if (EXCLUDED_EDIT_STATUSES.includes(entity.actAuctionStatus)) {
            if (!cancelled) {
              setErrorMsg('This listing can no longer be edited — it is live, sold, or awaiting a winner\'s payment.');
              setPhase('error');
            }
            return;
          }
          if (!cancelled) { loadItemIntoForm(entity); setPhase('ready'); }
        } catch (err) {
          if (!cancelled) { setErrorMsg(err.message || 'Failed to load this listing'); setPhase('error'); }
        }
        return;
      }

      // Draft mode
      const cachedDocId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID) : null;
      if (cachedDocId) {
        try {
          // FIXED: this used to omit `populate[seller]`, so entity.seller
          // was always undefined and the ownership check below always
          // failed — meaning a perfectly valid cached draft got wiped and
          // recreated on EVERY page load. seller's id is now populated.
          const res = await apiClient.get(
            `/auction-items/${cachedDocId}?populate[actImages][populate]=*&populate[seller][fields][0]=id`
          );
          const entity = res?.data || res;
          const ownerId = apiClient.resolveId(entity.seller, 'id');
          const viewerId = apiClient.resolveId(user, 'id');

          if (entity.actIsDraft && String(ownerId) === String(viewerId)) {
            if (!cancelled) { loadItemIntoForm(entity); setPhase('ready'); }
            return;
          }
          // Cached draft is gone/no longer a draft/not ours — clear and fall through.
          localStorage.removeItem(STORAGE_KEYS.CURRENT_DRAFT_ID);
          localStorage.removeItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID);
        } catch {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_DRAFT_ID);
          localStorage.removeItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID);
        }
      }

      // No usable cached draft. Before creating one, claim the creation
      // lock — if another concurrent init (Strict Mode double-invoke, a
      // fast double-click into Sell, etc.) already grabbed it, wait for
      // that one to publish a draft id instead of racing it.
      if (!tryAcquireDraftCreationLock()) {
        const publishedDocId = await waitForCachedDraftId();
        if (cancelled) return;
        if (publishedDocId) {
          try {
            const res = await apiClient.get(`/auction-items/${publishedDocId}?populate[actImages][populate]=*`);
            if (!cancelled) { loadItemIntoForm(res?.data || res); setPhase('ready'); }
          } catch (err) {
            if (!cancelled) { setErrorMsg(err.message || 'Failed to load your draft'); setPhase('error'); }
          }
          return;
        }
        // Timed out with nothing published (the other attempt likely
        // errored out and released its lock) — fall through and try
        // claiming the lock ourselves.
        if (!tryAcquireDraftCreationLock()) {
          if (!cancelled) { setErrorMsg('Failed to create a draft listing — please try again'); setPhase('error'); }
          return;
        }
      }

      try {
        if (!cancelled) {
          await createNewDraft(countryList, countryConfig?.countryId);
        }
      } finally {
        releaseDraftCreationLock();
      }
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, userId]);

  // Redirect unauthenticated visitors, matching every other protected page.
  useEffect(() => {
    if (hydrated && !isAuthenticated()) router.push('/login');
  }, [hydrated, isAuthenticated, router]);

  // ── Other drafts, for the browser below the form (draft mode only) ──
  // FIXED: was GET /auction-items?filters[seller][id][$eq]=... — Strapi
  // rejects filtering by relations to plugin::users-permissions.user
  // through the plain REST API ("Invalid key seller"). Now uses the custom
  // /auction-items/mine endpoint (see the file-level comment + README for
  // the required backend addition), filtered to drafts client-side.
  useEffect(() => {
    if (isEditMode || !user) return;
    apiClient
      .get('/auction-items/mine')
      .then((res) => setDrafts((res?.items || []).filter((i) => i.actIsDraft)))
      .catch((err) => console.error('Failed to load drafts:', err.status, err.message));
  }, [isEditMode, user, item]);

  const switchToDraft = async (draft) => {
    const docId = apiClient.resolveId(draft);
    setPhase('checking');
    try {
      await loadExistingDraftById(docId);
      setPhase('ready');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load that draft');
      setPhase('error');
    }
  };

  const handleCreateNewListing = () => {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_DRAFT_ID);
    localStorage.removeItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID);
    setItem(null);
    createNewDraft(countries, countryConfig?.countryId);
  };

  // ── Field handlers ──
  const handleTitleChange = (v) => { setTitle(v); queueChange('actTitle', v || 'Untitled'); };
  const handleDescriptionChange = (v) => { setDescription(v); queueChange('actDescription', v); };
  const handlePriceChange = (v) => {
    setStartingPrice(v);
    const num = Number(v);
    // Autosave 0 too (explicitly "no price set" is a valid saved state for
    // a draft) — only skip saving genuinely invalid/NaN input.
    if (!Number.isNaN(num) && num >= 0) queueChange('actStartingPriceNative', num);
  };
  const handleTownChange = (v) => { setTown(v); queueChange('actTown', v); };
  const handleCountryChange = (id) => {
    setSelectedCountryId(id);
    setTown('');
    queueChange('itemOriginCountry', id);
    // Safeguard — see the CURRENCY NOTE at the top of this file.
    const c = countries.find((c) => c.id === id);
    if (c?.currency?.currCode) queueChange('actNativeCurrencyCode', c.currency.currCode);
  };
  const handleEndDateTimeChange = (v) => {
    setEndDateTime(v);
    if (v) queueChange('actListingTimeEnd', new Date(v).toISOString());
  };

  const numericItemId = apiClient.resolveId(item, 'id');

  const handleImageUpload = async (file) => {
    const media = await uploadFile(file, {
      ref: 'api::auction-item.auction-item',
      refId: numericItemId,
      field: 'actImages',
    });
    setItem((prev) => ({ ...prev, actImages: media }));
  };

  const handleImageRemove = () => {
    // NOTE: only clears local UI state — does not detach the file from the
    // entry server-side (no delete-media call here).
    setItem((prev) => ({ ...prev, actImages: [] }));
  };

  const handlePublish = async () => {
    setPublishError('');
    setPublishSuccess('');

    if (!title.trim()) { setPublishError('Give your listing a title'); return; }
    if (priceIsUnset) { setPublishError('Set a starting price before publishing — it\'s currently unset'); return; }
    if (priceBelowMinimum) {
      setPublishError(`Starting price must be at least ${minStartingPriceCurrency}${minStartingPrice}`);
      return;
    }
    if (!item?.actImages?.length) { setPublishError('Add at least one photo'); return; }
    if (towns.length > 0 && !town) { setPublishError("Select the town you're listing from"); return; }
    if (!endDateTime || new Date(endDateTime) <= new Date()) { setPublishError('Pick an auction end time in the future'); return; }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await flushChanges();

    try {
      setPublishing(true);
      await apiClient.put(`/auction-items/${apiClient.resolveId(item)}`, {
        data: {
          actIsDraft: false,
          actAuctionStatus: 'active',
          actListingTimeStart: new Date().toISOString(),
          actListingTimeEnd: new Date(endDateTime).toISOString(),
        },
      });
      localStorage.removeItem(STORAGE_KEYS.CURRENT_DRAFT_ID);
      localStorage.removeItem(STORAGE_KEYS.DRAFT_DOCUMENT_ID);
      setPublishSuccess('Listing published!');
      setTimeout(() => router.push('/'), 900);
    } catch (err) {
      setPublishError(err.message || 'Failed to publish listing');
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveEdit = async () => {
    setPublishError('');
    setPublishSuccess('');

    if (priceIsUnset) { setPublishError('Set a starting price — it\'s currently unset'); return; }
    if (priceBelowMinimum) {
      setPublishError(`Starting price must be at least ${minStartingPriceCurrency}${minStartingPrice}`);
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await flushChanges();
    setPublishSuccess('Changes saved.');
    setTimeout(() => router.push('/'), 700);
  };

  // ── Render ──

  if (phase === 'checking' || phase === 'creating') {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
        <Skeleton variant="text" width={200} height={48} />
        <Skeleton variant="text" width={280} height={24} sx={{ mb: 3 }} />
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={56} />
          <Skeleton variant="rounded" height={96} />
          <Skeleton variant="rounded" height={56} />
          <Skeleton variant="rounded" height={56} />
          <Skeleton variant="rounded" height={140} />
          <Skeleton variant="rounded" height={56} />
        </Stack>
        {phase === 'creating' && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Setting up your draft…
          </Typography>
        )}
        <BottomNav />
      </Box>
    );
  }

  if (phase === 'error') {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
        <Alert severity="error" sx={{ borderRadius: 3 }}>{errorMsg}</Alert>
        <BottomNav />
      </Box>
    );
  }

  const totalDrafts = drafts.length;
  const otherDrafts = drafts.filter((d) => apiClient.resolveId(d) !== apiClient.resolveId(item));

  const draftsBrowser = !isEditMode && (
    <Box sx={{ mt: 4 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
        Your Drafts
      </Typography>

      <Stack spacing={1.5}>
        {totalDrafts > 2 && (
          <Button variant="outlined" onClick={handleCreateNewListing} sx={{ height: 48 }}>
            + Create New Auction Listing
          </Button>
        )}

        {otherDrafts.map((d) => {
          const thumb = d.actImages?.[0]?.url;
          const draftHasPrice = d.actStartingPriceNative > 0;
          return (
            <Box
              key={apiClient.resolveId(d)}
              onClick={() => switchToDraft(d)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2.5,
                cursor: 'pointer', bgcolor: 'background.paper',
                boxShadow: '0px 4px 16px rgba(0,0,0,0.35)',
              }}
            >
              <Box
                sx={{
                  width: 48, height: 48, borderRadius: 1.5, flexShrink: 0, bgcolor: 'rgba(148,163,184,0.08)',
                  backgroundImage: thumb ? `url(${getMediaUrl(thumb)})` : undefined,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                }}
              />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.actTitle && d.actTitle !== 'Untitled' ? d.actTitle : 'Untitled draft'}
                </Typography>
                <Typography variant="caption" color={draftHasPrice ? 'text.secondary' : 'error.main'}>
                  {draftHasPrice
                    ? formatCurrency(d.actStartingPriceNative, d.actNativeCurrencyCode)
                    : 'No price set'}
                </Typography>
              </Box>
              <Chip size="small" label="Draft" sx={{ height: 20, fontSize: 10 }} />
            </Box>
          );
        })}

        {totalDrafts <= 2 && (
          <Button variant="outlined" onClick={handleCreateNewListing} sx={{ height: 48 }}>
            + Create New Auction Listing
          </Button>
        )}
      </Stack>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3, pb: 10 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        {isEditMode ? 'Edit Listing' : 'Sell an Item'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {isEditMode
          ? 'Changes save automatically as you type.'
          : 'Your progress saves automatically — publish whenever you\'re ready.'}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField fullWidth label="Title" value={title} onChange={(e) => handleTitleChange(e.target.value)} />
        <TextField
          fullWidth
          multiline
          minRows={3}
          label="Description"
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
        />

        <TextField
          select
          fullWidth
          label="Country"
          value={selectedCountryId}
          onChange={(e) => handleCountryChange(e.target.value)}
          disabled={countriesLoading}
        >
          {countries.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.countryName}</MenuItem>
          ))}
        </TextField>

        <TextField
          select
          fullWidth
          label="Town"
          value={town}
          onChange={(e) => handleTownChange(e.target.value)}
          disabled={countriesLoading || !selectedCountryId}
          helperText={
            !countriesLoading && towns.length === 0
              ? `No towns configured for ${selectedCountry?.countryName || 'this country'} yet`
              : undefined
          }
        >
          {towns.map((t) => (
            <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
          ))}
        </TextField>

        <TextField
          fullWidth
          type="number"
          label="Starting price"
          value={startingPrice}
          onChange={(e) => handlePriceChange(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start">{currencyLabel}</InputAdornment> }}
          error={priceIsUnset || priceBelowMinimum}
          helperText={
            priceIsUnset
              ? 'No price set — this listing cannot be published until you set one'
              : priceBelowMinimum
                ? `Below the minimum of ${minStartingPriceCurrency}${minStartingPrice}`
                : selectedCountry
                  ? `Priced in ${selectedCountry.countryName}'s currency (${selectedCountry.currency?.currCode || '—'})${minStartingPrice != null ? ` — minimum ${minStartingPriceCurrency}${minStartingPrice}` : ''}`
                  : undefined
          }
        />

        <TextField
          fullWidth
          type="datetime-local"
          label="Auction ends at"
          value={endDateTime}
          onChange={(e) => handleEndDateTimeChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />

        <DocumentUploadCard
          title="Item photo"
          description="A clear photo of the item you're listing"
          maxSize={5}
          uploadedFile={item?.actImages?.[0] || null}
          onUpload={handleImageUpload}
          onRemove={handleImageRemove}
          disabled={!item}
        />

        {publishError && <Alert severity="error" sx={{ borderRadius: 3 }}>{publishError}</Alert>}
        {publishSuccess && <Alert severity="success" sx={{ borderRadius: 3 }}>{publishSuccess}</Alert>}

        <Button
          fullWidth
          variant="contained"
          color="secondary"
          size="large"
          onClick={isEditMode ? handleSaveEdit : handlePublish}
          disabled={publishing}
          sx={{ height: 56, fontWeight: 700 }}
        >
          {publishing ? <CircularProgress size={24} color="inherit" /> : isEditMode ? 'Save Changes' : 'Publish Listing'}
        </Button>
      </Box>

      {draftsBrowser}

      <BottomNav />
    </Box>
  );
}

export default function SellPage() {
  return (
    <Suspense fallback={<Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress color="secondary" /></Box>}>
      <SellPageInner />
    </Suspense>
  );
}