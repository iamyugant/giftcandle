import { AttentionBox, Button, Flex, Search, Skeleton, Text, TextField, Toast } from "@vibe/core";
import { useCallback, useEffect, useState } from "react";
import { ApiError, addFragrance, deleteFragrance, fetchFragrances, updateFragrance } from "./api";

const BLANK_DRAFT = { name: "", description: "", category: "", image_url: "" };

const toDraft = (fragrance) => ({
  name: fragrance.name,
  description: fragrance.description,
  category: fragrance.category,
  image_url: fragrance.image_url ?? "",
});

const toInput = (draft) => ({
  name: draft.name,
  description: draft.description,
  category: draft.category,
  ...(draft.image_url.trim() ? { image_url: draft.image_url.trim() } : {}),
});

const matchesQuery = (fragrance, query) =>
  `${fragrance.name} ${fragrance.category} ${fragrance.description}`.toLowerCase().includes(query.toLowerCase());

export function AdminScreen() {
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(BLANK_DRAFT);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(() => {
    setLoadError(null);
    setItems(null);
    fetchFragrances().then(setItems, (e) => setLoadError(e.message));
  }, []);

  useEffect(load, [load]);

  const openForm = (id, next) => {
    setEditingId(id);
    setDraft(next);
    setFieldErrors({});
    setFormError(null);
  };

  const startNew = () => openForm("new", BLANK_DRAFT);
  const startEdit = (fragrance) => openForm(fragrance.id, toDraft(fragrance));
  const cancel = () => setEditingId(null);

  const save = async () => {
    if (saving) return;

    setSaving(true);
    setFieldErrors({});
    setFormError(null);

    const isNew = editingId === "new";
    try {
      if (isNew) await addFragrance(toInput(draft));
      else await updateFragrance(editingId, toInput(draft));

      setToast(`${isNew ? "Added" : "Saved"} ${draft.name.trim()}.`);
      setEditingId(null);
      load();
    } catch (e) {
      showSaveError(e);
    } finally {
      setSaving(false);
    }
  };

  const showSaveError = (e) => {
    if (!(e instanceof ApiError)) return setFormError("Could not save. Try again.");

    setFieldErrors(e.fields ?? {});
    setFormError(e.message);
  };

  const remove = async (fragrance) => {
    try {
      await deleteFragrance(fragrance.id);
      setConfirmDeleteId(null);
      setToast(`Deleted ${fragrance.name}.`);
      load();
    } catch (e) {
      setConfirmDeleteId(null);
      setLoadError(e instanceof Error ? e.message : "Could not delete.");
    }
  };

  const change = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors(({ [key]: _cleared, ...rest }) => rest);
    setFormError(null);
  };

  const field = (key) => (fieldErrors[key] ? { status: "error", text: fieldErrors[key] } : undefined);

  return (
    <Flex direction="column" align="stretch" gap={16} style={{ padding: 16, maxWidth: 820 }}>
      <Flex justify="space-between" align="center">
        <Text type="text1" weight="bold">
          Fragrance library
        </Text>
        <Button size="small" onClick={startNew} disabled={editingId !== null}>
          Add fragrance
        </Button>
      </Flex>

      {editingId !== null && (
        <Flex direction="column" align="stretch" gap={8}>
          <Text type="text2" weight="bold">
            {editingId === "new" ? "New fragrance" : "Edit fragrance"}
          </Text>
          <TextField
            title="Name"
            inputAriaLabel="Name"
            required
            value={draft.name}
            onChange={(v) => change("name", v)}
            validation={field("name")}
          />
          <TextField
            title="Category"
            inputAriaLabel="Category"
            required
            value={draft.category}
            onChange={(v) => change("category", v)}
            validation={field("category")}
          />
          <TextField
            title="Description (scent notes)"
            inputAriaLabel="Description (scent notes)"
            required
            value={draft.description}
            onChange={(v) => change("description", v)}
            validation={field("description")}
          />
          <TextField
            title="Image URL (optional)"
            inputAriaLabel="Image URL (optional)"
            value={draft.image_url}
            onChange={(v) => change("image_url", v)}
            validation={field("image_url")}
          />
          {formError && <Text type="text2" color="negative">{formError}</Text>}
          <Flex gap={8}>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
            <Button kind="tertiary" onClick={cancel}>
              Cancel
            </Button>
          </Flex>
        </Flex>
      )}

      <FragranceList
        items={items}
        loadError={loadError}
        onRetry={load}
        query={query}
        onQueryChange={setQuery}
        confirmDeleteId={confirmDeleteId}
        onAskDelete={setConfirmDeleteId}
        onDelete={remove}
        onEdit={startEdit}
      />

      <Toast open={toast !== null} type="positive" autoHideDuration={4000} onClose={() => setToast(null)}>
        {toast ?? ""}
      </Toast>
    </Flex>
  );
}

function FragranceList({
  items,
  loadError,
  onRetry,
  query,
  onQueryChange,
  confirmDeleteId,
  onAskDelete,
  onDelete,
  onEdit,
}) {
  if (loadError) {
    return (
      <Flex direction="column" align="stretch" gap={8}>
        <AttentionBox type="danger" title="Something went wrong" text={loadError} />
        <div>
          <Button size="small" kind="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </Flex>
    );
  }

  if (!items) return <Skeleton height={160} />;

  if (items.length === 0) return <Text type="text2">No fragrances yet. Add the first one.</Text>;

  const visible = items.filter((fragrance) => matchesQuery(fragrance, query));

  return (
    <>
      <Search placeholder="Search fragrances" value={query} onChange={onQueryChange} />
      {visible.length === 0 && <Text type="text2">No fragrances match.</Text>}
      <Flex direction="column" align="stretch" gap={4}>
        {visible.map((fragrance) => (
          <Flex key={fragrance.id} justify="space-between" align="center" gap={8}>
            <Text type="text2">
              <strong>{fragrance.name}</strong> · {fragrance.category} · {fragrance.description}
            </Text>

            {confirmDeleteId === fragrance.id ? (
              <Flex gap={4} align="center">
                <Text type="text2" color="negative">
                  Delete {fragrance.name}?
                </Text>
                <Button size="small" color="negative" onClick={() => onDelete(fragrance)}>
                  Delete
                </Button>
                <Button size="small" kind="tertiary" onClick={() => onAskDelete(null)}>
                  Keep
                </Button>
              </Flex>
            ) : (
              <Flex gap={4}>
                <Button size="small" kind="tertiary" ariaLabel={`Edit ${fragrance.name}`} onClick={() => onEdit(fragrance)}>
                  Edit
                </Button>
                <Button
                  size="small"
                  kind="tertiary"
                  ariaLabel={`Delete ${fragrance.name}`}
                  onClick={() => onAskDelete(fragrance.id)}
                >
                  Delete
                </Button>
              </Flex>
            )}
          </Flex>
        ))}
      </Flex>
    </>
  );
}
