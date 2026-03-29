import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ImagePreviewModal } from '@/components/ImagePreviewModal';
import {
  pickNewCostumePhotoFromCamera,
  pickNewCostumePhotoFromGallery,
} from '@/components/ImagePicker';
import { SessionMap } from '@/components/SessionMap';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  addCostumePhoto,
  addSessionShare,
  createCostume,
  getCandyLogs,
  getCostume,
  getCostumePhotosForSession,
  getCostumes,
  getHouseVisits,
  getLocationPoints,
  getProfile,
  getProfiles,
  getSession,
  getSessionSharedWithProfileIds,
  getSessionStats,
  removeSessionShare,
  updateSession,
} from '@/lib/db';
import { getImageUri } from '@/lib/images';
import type {
  CandyLog,
  Costume,
  CostumePhoto,
  House,
  HouseVisit,
  LocationPoint,
  Profile,
  Session,
} from '@/types';
import { useSQLiteContext } from 'expo-sqlite';
import { Image } from 'react-native';

export default function SessionSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const theme = useTheme();
  const { profile } = useProfile();
  const [session, setSession] = useState<Session | null>(null);
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [candy, setCandy] = useState<CandyLog[]>([]);
  const [houseVisits, setHouseVisits] = useState<(HouseVisit & { house?: House })[]>([]);
  const [selectedHouseVisit, setSelectedHouseVisit] = useState<(HouseVisit & { house?: House }) | null>(null);
  const [stats, setStats] = useState({ candyCount: 0, houseCount: 0 });
  const [costumeDetail, setCostumeDetail] = useState<Costume | null>(null);
  const [homesHaulExpanded, setHomesHaulExpanded] = useState(false);
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);
  const [sharedWithProfiles, setSharedWithProfiles] = useState<Profile[]>([]);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCostumes, setEditCostumes] = useState<{ id: number; name: string }[]>([]);
  const [editCostumeName, setEditCostumeName] = useState('');
  const [addingEditCostume, setAddingEditCostume] = useState(false);
  const [summaryCostumePhotos, setSummaryCostumePhotos] = useState<CostumePhoto[]>([]);
  const [summaryCostumePhotoBusy, setSummaryCostumePhotoBusy] = useState<
    'camera' | 'gallery' | null
  >(null);
  const [imagePreviewUri, setImagePreviewUri] = useState<string | null>(null);

  const loadSharedWith = useCallback(
    async (sessionId: number) => {
      const ids = await getSessionSharedWithProfileIds(db, sessionId);
      const profiles = await Promise.all(ids.map((pid) => getProfile(db, pid)));
      setSharedWithProfiles(profiles.filter((p): p is Profile => p != null));
    },
    [db]
  );

  useEffect(() => {
    if (!id) return;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return;

    (async () => {
      setLoading(true);
      const s = await getSession(db, numId);
      setSession(s ?? null);
      if (s) {
        const owner = await getProfile(db, s.profile_id);
        setOwnerProfile(owner ?? null);
        const [pts, candyLogs, visits, sessionStats] = await Promise.all([
          getLocationPoints(db, s.id),
          getCandyLogs(db, s.profile_id, s.id),
          getHouseVisits(db, s.id),
          getSessionStats(db, s.id),
        ]);
        setPoints(pts);
        setCandy(candyLogs);
        setHouseVisits(visits);
        setStats(sessionStats);
        if (s.costume_id) {
          const c = await getCostume(db, s.costume_id);
          setCostumeDetail(c ?? null);
          const photos = await getCostumePhotosForSession(db, s.costume_id, s.id);
          setSummaryCostumePhotos(photos);
        } else {
          setCostumeDetail(null);
          setSummaryCostumePhotos([]);
        }
        getCostumes(db, s.profile_id).then((c) =>
          setEditCostumes(c.map((x) => ({ id: x.id, name: x.name })))
        );
        await loadSharedWith(s.id);
      }
      setLoading(false);
    })();
  }, [id, db, loadSharedWith]);

  async function applySessionCostumeId(costumeId: number | null) {
    if (!session) return;
    await updateSession(db, session.id, { costumeId });
    const s = await getSession(db, session.id);
    if (s) setSession(s);
    if (costumeId != null && s) {
      const c = await getCostume(db, costumeId);
      setCostumeDetail(c ?? null);
      setSummaryCostumePhotos(await getCostumePhotosForSession(db, costumeId, s.id));
    } else {
      setCostumeDetail(null);
      setSummaryCostumePhotos([]);
    }
  }

  async function addSummaryCostumePhoto(path: string | null) {
    if (!path || !session?.costume_id) return;
    await addCostumePhoto(db, session.costume_id, path, session.id);
    const list = await getCostumePhotosForSession(db, session.costume_id, session.id);
    setSummaryCostumePhotos(list);
    const c = await getCostume(db, session.costume_id);
    if (c) setCostumeDetail(c);
  }

  async function takeSummaryCostumeFromCamera() {
    if (!session?.costume_id) return;
    setSummaryCostumePhotoBusy('camera');
    try {
      const path = await pickNewCostumePhotoFromCamera();
      await addSummaryCostumePhoto(path);
    } catch (e) {
      console.error(e);
    } finally {
      setSummaryCostumePhotoBusy(null);
    }
  }

  async function takeSummaryCostumeFromGallery() {
    if (!session?.costume_id) return;
    setSummaryCostumePhotoBusy('gallery');
    try {
      const path = await pickNewCostumePhotoFromGallery();
      await addSummaryCostumePhoto(path);
    } catch (e) {
      console.error(e);
    } finally {
      setSummaryCostumePhotoBusy(null);
    }
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.colors.background },
        content: { padding: theme.spacing.lg },
        center: { justifyContent: 'center', alignItems: 'center' },
        title: {
          fontSize: theme.fontSize.xxl,
          fontWeight: 'bold',
          color: theme.colors.primary,
          textAlign: 'center',
          marginBottom: theme.spacing.lg,
        },
        mapWrap: {
          height: 220,
          marginBottom: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
          overflow: 'hidden',
        },
        map: { flex: 1 },
        stats: { flexDirection: 'row', gap: theme.spacing.lg, marginBottom: theme.spacing.lg },
        stat: {
          flex: 1,
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
        },
        statValue: {
          fontSize: theme.fontSize.xxl,
          fontWeight: 'bold',
          color: theme.colors.text,
        },
        statLabel: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
        costume: {
          fontSize: theme.fontSize.md,
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.xs,
        },
        costumeBlock: {
          marginBottom: theme.spacing.md,
        },
        costumeSummaryImage: {
          width: '100%',
          maxWidth: 280,
          alignSelf: 'center',
          aspectRatio: 3 / 4,
          borderRadius: theme.borderRadius.lg,
          backgroundColor: theme.colors.border,
          marginTop: theme.spacing.sm,
        },
        collapseHeader: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.sm,
        },
        collapseHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        },
        collapseTitle: {
          fontSize: theme.fontSize.xl,
          fontWeight: '600',
          color: theme.colors.text,
          flex: 1,
        },
        collapseHint: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginTop: theme.spacing.xs,
        },
        meta: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.lg,
        },
        sectionTitle: {
          fontSize: theme.fontSize.xl,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: theme.spacing.md,
        },
        candyRow: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.sm,
        },
        candyThumb: {
          width: 48,
          height: 48,
          borderRadius: theme.borderRadius.sm,
          marginRight: theme.spacing.md,
        },
        candyInfo: { flex: 1 },
        candyName: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: theme.colors.text,
        },
        candyQty: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
        houseCandyBlock: { marginBottom: theme.spacing.lg },
        houseCandyHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.sm,
        },
        houseCandyHouseThumb: {
          width: 44,
          height: 44,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.border,
        },
        houseCandyLabel: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: theme.colors.secondary,
          flex: 1,
        },
        houseListRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.xs,
        },
        houseItem: {
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
          flex: 1,
        },
        doneBtn: {
          backgroundColor: theme.colors.primary,
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
          alignItems: 'center',
          marginTop: theme.spacing.lg,
          marginBottom: theme.spacing.xl,
        },
        doneBtnPressed: { opacity: 0.9 },
        doneBtnText: {
          fontSize: theme.fontSize.lg,
          fontWeight: '600',
          color: '#fff',
        },
        shareSection: {
          marginBottom: theme.spacing.lg,
        },
        shareRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.xs,
        },
        shareBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: theme.colors.primary,
          borderRadius: theme.borderRadius.md,
        },
        shareBtnText: { fontSize: theme.fontSize.md, fontWeight: '600', color: '#fff' },
        sharedFrom: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginBottom: theme.spacing.sm },
        unshareBtn: { padding: theme.spacing.xs },
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: theme.spacing.lg,
        },
        modalContent: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.lg,
          width: '100%',
          maxWidth: 320,
          maxHeight: '70%',
        },
        modalTitle: { fontSize: theme.fontSize.lg, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.md },
        profileOption: {
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        houseModalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: theme.spacing.lg,
        },
        houseModalContent: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.lg,
          width: '100%',
          maxWidth: 360,
        },
        houseModalImage: {
          width: '100%',
          aspectRatio: 4 / 3,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.border,
          marginBottom: theme.spacing.md,
        },
        houseModalTitle: {
          fontSize: theme.fontSize.lg,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: theme.spacing.sm,
        },
        houseModalClose: {
          marginTop: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          alignItems: 'center',
        },
        houseModalCloseText: {
          fontSize: theme.fontSize.md,
          color: theme.colors.primary,
          fontWeight: '600',
        },
        summaryCostumeEdit: {
          marginBottom: theme.spacing.lg,
        },
        costChipRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md,
        },
        costChip: {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.borderRadius.lg,
          backgroundColor: theme.colors.border,
        },
        costChipActive: { backgroundColor: theme.colors.primary },
        costChipText: { fontSize: theme.fontSize.md, color: theme.colors.text },
        costChipTextActive: { color: '#fff', fontWeight: '600' },
        costAddRow: {
          flexDirection: 'row',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md,
        },
        costAddInput: {
          flex: 1,
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
        },
        costAddBtn: {
          paddingHorizontal: theme.spacing.lg,
          justifyContent: 'center',
          backgroundColor: theme.colors.secondary,
          borderRadius: theme.borderRadius.md,
        },
        costAddBtnDisabled: { opacity: 0.5 },
        costAddBtnText: { fontSize: theme.fontSize.md, fontWeight: '600', color: '#fff' },
        summaryCostumePhotoRow: {
          marginTop: theme.spacing.sm,
        },
        summaryCostumeStripHint: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.sm,
        },
        summaryCostumeStrip: {
          marginBottom: theme.spacing.md,
        },
        summaryCostumeStripInner: {
          flexDirection: 'row',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
        },
        summaryCostumeStripThumb: {
          width: 72,
          height: 72,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.border,
        },
        summaryPhotoBtns: {
          flex: 1,
          flexDirection: 'row',
          gap: theme.spacing.sm,
        },
        summaryPhotoBtnHalf: {
          flex: 1,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.xs,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.borderRadius.lg,
        },
        summaryPhotoBtnCam: { backgroundColor: theme.colors.primary },
        summaryPhotoBtnGal: { backgroundColor: theme.colors.secondary },
        summaryPhotoBtnText: { fontSize: theme.fontSize.sm, fontWeight: '600', color: '#fff' },
      }),
    [theme]
  );

  if (loading || !session) {
    return (
      <View style={[styles.center, styles.container]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const coords = points.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  const started = new Date(session.started_at);
  const ended = session.ended_at ? new Date(session.ended_at) : null;
  const duration = ended
    ? Math.round((ended.getTime() - started.getTime()) / 60000)
    : 0;

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Session complete!</Text>

      <View style={styles.mapWrap}>
        <SessionMap
          coordinates={coords}
          houses={houseVisits
            .filter((v) => v.house?.latitude != null && v.house?.longitude != null)
            .map((v) => ({
              id: v.house!.id,
              name: v.house!.name,
              latitude: v.house!.latitude!,
              longitude: v.house!.longitude!,
            }))}
          style={styles.map}
          onHousePress={(houseId) => {
            const v = houseVisits.find((x) => x.house_id === houseId);
            if (v) setSelectedHouseVisit(v);
          }}
        />
      </View>

      <Modal
        visible={selectedHouseVisit != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedHouseVisit(null)}
      >
        <Pressable style={styles.houseModalOverlay} onPress={() => setSelectedHouseVisit(null)}>
          <Pressable style={styles.houseModalContent} onStartShouldSetResponder={() => true}>
            {selectedHouseVisit?.house && (
              <>
                {selectedHouseVisit.house.image_path ? (
                  <Pressable
                    onPress={() =>
                      setImagePreviewUri(
                        getImageUri(selectedHouseVisit.house!.image_path) ?? null
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel="View house photo full size"
                  >
                    <Image
                      source={{ uri: getImageUri(selectedHouseVisit.house.image_path)! }}
                      style={styles.houseModalImage}
                      resizeMode="cover"
                    />
                  </Pressable>
                ) : (
                  <View style={[styles.houseModalImage, styles.center]} />
                )}
                <Text style={styles.houseModalTitle}>
                  {selectedHouseVisit.house.name}
                </Text>
                {selectedHouseVisit.house.notes ? (
                  <Text style={styles.meta}>{selectedHouseVisit.house.notes}</Text>
                ) : null}
              </>
            )}
            <Pressable
              style={styles.houseModalClose}
              onPress={() => setSelectedHouseVisit(null)}
            >
              <Text style={styles.houseModalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <FontAwesome name="gift" size={32} color={theme.colors.primary} />
          <Text style={styles.statValue}>{stats.candyCount}</Text>
          <Text style={styles.statLabel}>Pieces of candy</Text>
        </View>
        <View style={styles.stat}>
          <FontAwesome name="home" size={32} color={theme.colors.secondary} />
          <Text style={styles.statValue}>{stats.houseCount}</Text>
          <Text style={styles.statLabel}>Houses visited</Text>
        </View>
      </View>

      {profile && session && profile.id === session.profile_id ? (
        <View style={styles.summaryCostumeEdit}>
          <Text style={styles.sectionTitle}>Costume</Text>
          <View style={styles.costChipRow}>
            <Pressable
              style={[
                styles.costChip,
                session.costume_id === null && styles.costChipActive,
              ]}
              onPress={() => applySessionCostumeId(null)}
            >
              <Text
                style={[
                  styles.costChipText,
                  session.costume_id === null && styles.costChipTextActive,
                ]}
              >
                None
              </Text>
            </Pressable>
            {editCostumes.map((c) => (
              <Pressable
                key={c.id}
                style={[
                  styles.costChip,
                  session.costume_id === c.id && styles.costChipActive,
                ]}
                onPress={() => applySessionCostumeId(c.id)}
              >
                <Text
                  style={[
                    styles.costChipText,
                    session.costume_id === c.id && styles.costChipTextActive,
                  ]}
                >
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.costAddRow}>
            <TextInput
              style={styles.costAddInput}
              placeholder="New costume name"
              placeholderTextColor={theme.colors.textMuted}
              value={editCostumeName}
              onChangeText={setEditCostumeName}
            />
            <Pressable
              style={[
                styles.costAddBtn,
                (!editCostumeName.trim() || addingEditCostume) && styles.costAddBtnDisabled,
              ]}
              onPress={async () => {
                const name = editCostumeName.trim();
                if (!name || !session || addingEditCostume) return;
                setAddingEditCostume(true);
                try {
                  const cid = await createCostume(db, session.profile_id, name);
                  const id = Number(cid);
                  setEditCostumes((prev) => [...prev, { id, name }]);
                  setEditCostumeName('');
                  await applySessionCostumeId(id);
                } finally {
                  setAddingEditCostume(false);
                }
              }}
              disabled={!editCostumeName.trim() || addingEditCostume}
            >
              <Text style={styles.costAddBtnText}>Add</Text>
            </Pressable>
          </View>
          {session.costume_id != null && (
            <View style={styles.summaryCostumePhotoRow}>
              <Text style={styles.summaryCostumeStripHint}>
                Only photos from this session appear here. Open the Costumes tab for the full gallery
                across years.
              </Text>
              {summaryCostumePhotos.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.summaryCostumeStrip}
                  contentContainerStyle={styles.summaryCostumeStripInner}
                >
                  {summaryCostumePhotos.map((ph) => (
                    <Pressable
                      key={ph.id}
                      onPress={() =>
                        setImagePreviewUri(getImageUri(ph.image_path) ?? null)
                      }
                      accessibilityRole="button"
                      accessibilityLabel="View costume photo full size"
                    >
                      <Image
                        source={{ uri: getImageUri(ph.image_path)! }}
                        style={styles.summaryCostumeStripThumb}
                        resizeMode="cover"
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              <View style={styles.summaryPhotoBtns}>
                <Pressable
                  style={({ pressed }) => [
                    styles.summaryPhotoBtnHalf,
                    styles.summaryPhotoBtnCam,
                    (summaryCostumePhotoBusy || pressed) && { opacity: 0.85 },
                  ]}
                  onPress={takeSummaryCostumeFromCamera}
                  disabled={summaryCostumePhotoBusy !== null}
                >
                  {summaryCostumePhotoBusy === 'camera' ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <FontAwesome name="camera" size={16} color="#fff" />
                      <Text style={styles.summaryPhotoBtnText} numberOfLines={1}>
                        Photo
                      </Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.summaryPhotoBtnHalf,
                    styles.summaryPhotoBtnGal,
                    (summaryCostumePhotoBusy || pressed) && { opacity: 0.85 },
                  ]}
                  onPress={takeSummaryCostumeFromGallery}
                  disabled={summaryCostumePhotoBusy !== null}
                >
                  {summaryCostumePhotoBusy === 'gallery' ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <FontAwesome name="image" size={16} color="#fff" />
                      <Text style={styles.summaryPhotoBtnText} numberOfLines={1}>
                        Gallery
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>
      ) : (
        costumeDetail && (
          <View style={styles.costumeBlock}>
            <Text style={styles.costume}>Costume: {costumeDetail.name}</Text>
            {summaryCostumePhotos.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.summaryCostumeStrip}
                contentContainerStyle={styles.summaryCostumeStripInner}
              >
                {summaryCostumePhotos.map((ph) => (
                  <Pressable
                    key={ph.id}
                    onPress={() =>
                      setImagePreviewUri(getImageUri(ph.image_path) ?? null)
                    }
                    accessibilityRole="button"
                    accessibilityLabel="View costume photo full size"
                  >
                    <Image
                      source={{ uri: getImageUri(ph.image_path)! }}
                      style={styles.summaryCostumeStripThumb}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            ) : costumeDetail.image_path ? (
              <Pressable
                onPress={() =>
                  setImagePreviewUri(getImageUri(costumeDetail.image_path) ?? null)
                }
                accessibilityRole="button"
                accessibilityLabel="View costume photo full size"
              >
                <Image
                  source={{ uri: getImageUri(costumeDetail.image_path)! }}
                  style={styles.costumeSummaryImage}
                  resizeMode="cover"
                />
              </Pressable>
            ) : null}
          </View>
        )
      )}
      <Text style={styles.meta}>
        {started.toLocaleDateString()} · {duration} min
      </Text>

      {profile && session && ownerProfile && session.profile_id !== profile.id && (
        <Text style={styles.sharedFrom}>
          Shared from {ownerProfile.name}
        </Text>
      )}

      {profile && session && session.profile_id === profile.id && (
        <View style={styles.shareSection}>
          <Text style={styles.sectionTitle}>Share with other profiles</Text>
          {sharedWithProfiles.map((p) => (
            <View key={p.id} style={styles.shareRow}>
              <Text style={styles.candyName}>{p.name}</Text>
              <Pressable
                style={styles.unshareBtn}
                onPress={async () => {
                  await removeSessionShare(db, session.id, p.id);
                  await loadSharedWith(session.id);
                }}
              >
                <FontAwesome name="times-circle" size={22} color={theme.colors.textMuted} />
              </Pressable>
            </View>
          ))}
          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.9 }]}
            onPress={async () => {
              if (!session) return;
              const all = await getProfiles(db);
              const sharedIds = new Set(sharedWithProfiles.map((p) => p.id));
              setAvailableProfiles(
                all.filter((p) => p.id !== session.profile_id && !sharedIds.has(p.id))
              );
              setShareModalVisible(true);
            }}
          >
            <FontAwesome name="user-plus" size={18} color="#fff" />
            <Text style={styles.shareBtnText}>Share with another profile</Text>
          </Pressable>
        </View>
      )}

      {(houseVisits.length > 0 || candy.length > 0) && (
        <>
          <Pressable
            style={({ pressed }) => [styles.collapseHeader, pressed && { opacity: 0.92 }]}
            onPress={() => setHomesHaulExpanded((e) => !e)}
            accessibilityRole="button"
            accessibilityState={{ expanded: homesHaulExpanded }}
          >
            <View style={styles.collapseHeaderRow}>
              <Text style={styles.collapseTitle}>Homes & your haul</Text>
              <FontAwesome
                name={homesHaulExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.colors.textMuted}
              />
            </View>
            {!homesHaulExpanded && (
              <Text style={styles.collapseHint}>
                {stats.houseCount} house{stats.houseCount !== 1 ? 's' : ''} · {stats.candyCount}{' '}
                piece{stats.candyCount !== 1 ? 's' : ''} of candy — tap to expand
              </Text>
            )}
          </Pressable>

          {homesHaulExpanded && candy.length > 0 && (
            <>
              {houseVisits.map((v) => {
                const houseCandy = candy.filter((c) => c.house_id === v.house_id);
                if (houseCandy.length === 0) return null;
                return (
                  <View key={v.house_id} style={styles.houseCandyBlock}>
                    <View style={styles.houseCandyHeaderRow}>
                      {v.house?.image_path ? (
                        <Pressable
                          onPress={() =>
                            setImagePreviewUri(getImageUri(v.house!.image_path) ?? null)
                          }
                          accessibilityRole="button"
                          accessibilityLabel="View house photo full size"
                        >
                          <Image
                            source={{ uri: getImageUri(v.house.image_path)! }}
                            style={styles.houseCandyHouseThumb}
                            resizeMode="cover"
                          />
                        </Pressable>
                      ) : (
                        <View style={styles.houseCandyHouseThumb} />
                      )}
                      <Text style={styles.houseCandyLabel}>{v.house?.name ?? 'House'}</Text>
                    </View>
                    {houseCandy.map((c) => (
                      <View key={c.id} style={styles.candyRow}>
                        {c.image_path && (
                          <Pressable
                            onPress={() =>
                              setImagePreviewUri(getImageUri(c.image_path) ?? null)
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`View ${c.candy_name} photo full size`}
                          >
                            <Image
                              source={{ uri: getImageUri(c.image_path)! }}
                              style={styles.candyThumb}
                            />
                          </Pressable>
                        )}
                        <View style={styles.candyInfo}>
                          <Text style={styles.candyName}>{c.candy_name}</Text>
                          <Text style={styles.candyQty}>× {c.quantity}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })}
              {candy.filter((c) => c.house_id == null).length > 0 && (
                <View style={styles.houseCandyBlock}>
                  <Text style={styles.houseCandyLabel}>Other</Text>
                  {candy
                    .filter((c) => c.house_id == null)
                    .map((c) => (
                      <View key={c.id} style={styles.candyRow}>
                        {c.image_path && (
                          <Pressable
                            onPress={() =>
                              setImagePreviewUri(getImageUri(c.image_path) ?? null)
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`View ${c.candy_name} photo full size`}
                          >
                            <Image
                              source={{ uri: getImageUri(c.image_path)! }}
                              style={styles.candyThumb}
                            />
                          </Pressable>
                        )}
                        <View style={styles.candyInfo}>
                          <Text style={styles.candyName}>{c.candy_name}</Text>
                          <Text style={styles.candyQty}>× {c.quantity}</Text>
                        </View>
                      </View>
                    ))}
                </View>
              )}
            </>
          )}

          {homesHaulExpanded && candy.length === 0 && houseVisits.length > 0 && (
            <View style={{ marginBottom: theme.spacing.lg }}>
              {houseVisits.map((v, i) => (
                <View key={i} style={styles.houseListRow}>
                  {v.house?.image_path ? (
                    <Pressable
                      onPress={() =>
                        setImagePreviewUri(getImageUri(v.house!.image_path) ?? null)
                      }
                      accessibilityRole="button"
                      accessibilityLabel="View house photo full size"
                    >
                      <Image
                        source={{ uri: getImageUri(v.house.image_path)! }}
                        style={styles.houseCandyHouseThumb}
                        resizeMode="cover"
                      />
                    </Pressable>
                  ) : (
                    <View style={styles.houseCandyHouseThumb} />
                  )}
                  <Text style={styles.houseItem}>• {v.house?.name ?? 'House'}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <Pressable
        style={({ pressed }) => [styles.doneBtn, pressed && styles.doneBtnPressed]}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.doneBtnText}>Done</Text>
      </Pressable>

      <Modal
        visible={shareModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShareModalVisible(false)} />
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Share with profile</Text>
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator>
              {availableProfiles.length === 0 ? (
                <Text style={styles.meta}>No other profiles to share with.</Text>
              ) : (
                availableProfiles.map((p) => (
                  <Pressable
                    key={p.id}
                    style={styles.profileOption}
                    onPress={async () => {
                      if (!session) return;
                      await addSessionShare(db, session.id, p.id);
                      await loadSharedWith(session.id);
                      setShareModalVisible(false);
                    }}
                  >
                    <Text style={styles.candyName}>{p.name}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={{ height: theme.spacing.xl }} />
    </ScrollView>

    <ImagePreviewModal
      visible={imagePreviewUri != null}
      imageUri={imagePreviewUri}
      onClose={() => setImagePreviewUri(null)}
    />
    </>
  );
}
