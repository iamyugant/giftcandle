export const SCENTS_PER_BOX = 3;
export const MAX_INSCRIPTION = 80;
export const MAX_KITS = 1000;

const nameError = (value, message) => (value.trim() ? undefined : message);

const quantityError = (quantity) =>
  Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_KITS
    ? undefined
    : `Enter a whole number of boxes, from 1 to ${MAX_KITS.toLocaleString("en-US")}.`;

const scentsError = (ids) => {
  if (new Set(ids).size !== ids.length) return "Pick 3 different scents.";
  if (ids.length !== SCENTS_PER_BOX) return `Pick exactly ${SCENTS_PER_BOX} scents.`;
  return undefined;
};

const inscriptionError = (text) =>
  text.trim().length > MAX_INSCRIPTION ? `Keep the inscription to ${MAX_INSCRIPTION} characters or fewer.` : undefined;

export function validateOrder(form) {
  const checks = {
    firstName: nameError(form.firstName, "Enter the client's first name."),
    lastName: nameError(form.lastName, "Enter the client's last name."),
    quantity: quantityError(form.quantity),
    fragranceIds: scentsError(form.fragranceIds),
    inscription: inscriptionError(form.inscription),
  };

  return Object.fromEntries(Object.entries(checks).filter(([, message]) => message));
}
