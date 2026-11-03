import { AttentionBox, Button, Dropdown, Flex, Skeleton, Text, TextField, Toast, Tooltip } from "@vibe/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MAX_INSCRIPTION, SCENTS_PER_BOX, validateOrder } from "../../shared/order";
import { createOrder, fetchFragrances } from "./api";
import { localDate } from "./localDate";

const EMPTY_FORM = { firstName: "", lastName: "", quantity: 1, fragranceIds: [], inscription: "" };

const toOption = (fragrance) => ({ value: fragrance.id, label: fragrance.name });

const toOptionList = (next) => (Array.isArray(next) ? next : next ? [next] : []);

function boxSummary(quantity) {
  if (quantity === null || !Number.isInteger(quantity) || quantity <= 0) return "";

  const boxes = quantity === 1 ? "box" : "boxes";
  return ` · ${quantity} ${boxes}, ${quantity * SCENTS_PER_BOX} candles`;
}

export function OrderScreen({ boardId }) {
  const [fragrances, setFragrances] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [created, setCreated] = useState(null);

  const load = useCallback(() => {
    setLoadError(null);
    setFragrances(null);
    fetchFragrances().then(setFragrances, (e) => setLoadError(e.message));
  }, []);

  useEffect(load, [load]);

  const options = useMemo(() => (fragrances ?? []).map(toOption), [fragrances]);

  const selected = form.fragranceIds.map((id) => options.find((o) => o.value === id)).filter((o) => !!o);

  const menuOptions = selected.length >= SCENTS_PER_BOX ? selected : options;

  const errors = validateOrder(form);
  const valid = Object.keys(errors).length === 0;

  const hint = errors.fragranceIds ? "Select exactly 3 scents to start order." : Object.values(errors)[0];

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  const edit = (patch) => {
    setTouched(true);
    set(patch);
  };

  const fieldError = (field) => (touched && errors[field] ? { status: "error", text: errors[field] } : undefined);

  const submit = async () => {
    setTouched(true);

    if (!valid || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const order = await createOrder({ ...form, boardId, receivedDate: localDate(new Date()) });
      setCreated({ id: order.id });

      setForm(EMPTY_FORM);
      setTouched(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "The order could not be created.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flex direction="column" align="stretch" gap={16} style={{ padding: 24, maxWidth: 1000 }}>
      <Flex gap={12} align="start">
        <div style={{ flex: 1 }}>
          <TextField
            title="First Name"
            inputAriaLabel="First Name"
            placeholder="Enter Customer First Name"
            value={form.firstName}
            onChange={(v) => edit({ firstName: v })}
            validation={fieldError("firstName")}
          />
        </div>
        <div style={{ flex: 1 }}>
          <TextField
            title="Last Name"
            inputAriaLabel="Last Name"
            placeholder="Enter Customer Lastname"
            value={form.lastName}
            onChange={(v) => edit({ lastName: v })}
            validation={fieldError("lastName")}
          />
        </div>
        <div style={{ flex: 1 }}>
          <TextField
            title="Quantity"
            inputAriaLabel="Quantity"
            type="number"
            value={form.quantity === null ? "" : String(form.quantity)}
            onChange={(v) => edit({ quantity: v === "" ? null : Number(v) })}
            validation={fieldError("quantity")}
          />
        </div>
      </Flex>

      <ScentSection
        fragrances={fragrances}
        loadError={loadError}
        onRetry={load}
        selected={selected}
        menuOptions={menuOptions}
        chosenCount={form.fragranceIds.length}
        error={touched ? errors.fragranceIds : undefined}
        onChange={(ids) => set({ fragranceIds: ids })}
      />

      <Flex direction="column" align="stretch" gap={4}>
        <TextField
          title="Inscription Request (optional)"
          inputAriaLabel="Inscription Request (optional)"
          value={form.inscription}
          onChange={(v) => edit({ inscription: v })}
          validation={fieldError("inscription")}
        />
        <Text type="text2" color="secondary">
          {`${form.inscription.trim().length}/${MAX_INSCRIPTION} characters${boxSummary(form.quantity)}`}
        </Text>
      </Flex>

      {submitError && (
        <Flex direction="column" align="stretch" gap={8}>
          <AttentionBox type="danger" title="The order was not created" text={submitError} />
          <div>
            <Button size="small" kind="secondary" onClick={submit}>
              Try again
            </Button>
          </div>
        </Flex>
      )}

      <Flex direction="column" align="start" gap={8}>
        <Tooltip content={valid ? undefined : hint} position="top">
          <span style={{ display: "inline-block" }}>
            <Button
              size="large"
              onClick={submit}
              loading={submitting}
              disabled={!valid || submitting}
              style={{ minWidth: 320 }}
            >
              Start Order
            </Button>
          </span>
        </Tooltip>
      </Flex>

      <Toast open={created !== null} type="positive" autoHideDuration={5000} onClose={() => setCreated(null)}>
        {created ? `Order created on the board (item ${created.id}).` : ""}
      </Toast>
    </Flex>
  );
}

function ScentSection({
  fragrances,
  loadError,
  onRetry,
  selected,
  menuOptions,
  chosenCount,
  error,
  onChange,
}) {
  if (loadError) {
    return (
      <Flex direction="column" align="stretch" gap={8}>
        <AttentionBox type="danger" title="Could not load the fragrances" text={loadError} />
        <div>
          <Button size="small" kind="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </Flex>
    );
  }

  if (!fragrances) return <Skeleton height={48} />;

  if (fragrances.length === 0) {
    return <Text type="text2">No fragrances yet. Ask the Production Manager to add the first one.</Text>;
  }

  const handleChange = (next) => onChange(toOptionList(next).slice(0, SCENTS_PER_BOX).map((o) => o.value));

  return (
    <Flex direction="column" align="stretch" gap={4}>
      <Dropdown
        multi
        multiline
        closeMenuOnSelect={false}
        placeholder={`Select ${SCENTS_PER_BOX} fragrances`}
        ariaLabel="Fragrances"
        options={menuOptions}
        value={selected}
        onChange={handleChange}
        noOptionsMessage={() => "No scents match."}
      />
      <Text type="text2" color={error ? "negative" : "secondary"}>
        {error ?? `${chosenCount} of ${SCENTS_PER_BOX} chosen. Each box has ${SCENTS_PER_BOX} different scents.`}
      </Text>
    </Flex>
  );
}
