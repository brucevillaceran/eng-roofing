import {
  personName,
  phoneNumber,
  emailAddress,
  numberValue,
  dateValue,
  timeValue,
  textValue,
  passwordValue,
  choice,
  limits,
} from "../shared/validation.js";
export function fieldConstraints({
  name,
  label,
  type,
  required,
  options,
  ...props
}) {
  const phone = ["phone", "contact"].includes(name);
  const person =
    /^(?:Full|First|Middle|Last|Employee|Client|Foreman) name$/i.test(label);
  const numeric = {
    price: { max: limits.price },
    rate: { min: 0.01, max: limits.rate },
    amount: { min: 0.01, max: limits.amount },
    quantity: { min: 0.01, max: limits.quantity },
    used: { max: limits.quantity },
    delivered: { max: limits.quantity },
    area: { min: 0.01, max: limits.measurement },
    linear: { max: limits.measurement },
    sections: { min: 1, max: limits.sections, step: 1 },
    progress: { max: 100 },
    hours: { max: 8 },
  };
  return {
    "data-validation": phone
      ? "phone"
      : person
        ? "person"
        : options
          ? "select"
          : type,
    "data-label": label,
    ...(phone
      ? {
          type: "tel",
          inputMode: "numeric",
          maxLength: 11,
          minLength: required ? 11 : undefined,
          pattern: "09[0-9]{9}",
          placeholder: "09123456789",
        }
      : {}),
    ...(person ? { maxLength: 150 } : {}),
    ...(type === "email" ? { maxLength: 254 } : {}),
    ...(type === "password" ? { maxLength: 128 } : {}),
    ...(type === "textarea" ? { maxLength: limits.text } : {}),
    ...(type === "text" && !phone && !person
      ? {
          maxLength: name === "address" ? 500 : name === "thickness" ? 30 : 150,
        }
      : {}),
    ...(type === "number"
      ? { min: 0, max: limits.amount, step: 0.01, ...numeric[name] }
      : {}),
    ...(type === "date" ? { min: "2000-01-01", max: "2100-12-31" } : {}),
  };
}
export function checkField(element, normalize = false) {
  if (
    element.disabled ||
    ["file", "checkbox", "submit", "button"].includes(element.type)
  )
    return;
  const field =
    element.dataset.label ||
    element.getAttribute("aria-label") ||
    element.name ||
    "Field";
  const kind = element.dataset.validation || element.type,
    value = element.value;
  element.setCustomValidity("");
  try {
    if (!value && !element.required) {
      if (element.validity.badInput)
        throw new Error(`${field}: enter a valid value.`);
      return;
    }
    let normalized = value;
    if (kind === "phone")
      normalized = phoneNumber(value, field, element.required);
    else if (kind === "person") normalized = personName(value, field);
    else if (kind === "email") normalized = emailAddress(value, field);
    else if (kind === "number")
      normalized = numberValue(value, field, {
        min: element.min === "" ? 0 : Number(element.min),
        max: element.max === "" ? limits.amount : Number(element.max),
        decimals: element.step === "1" ? 0 : 2,
      });
    else if (kind === "date")
      normalized = dateValue(value, field, {
        min: element.min || "2000-01-01",
        max: element.max || "2100-12-31",
      });
    else if (kind === "time") normalized = timeValue(value, field);
    else if (kind === "password")
      passwordValue(value, field, {
        login: element.minLength < 12,
        optional: !element.required,
      });
    else if (kind === "select")
      choice(
        value,
        field,
        [...element.options].map((o) => o.value),
      );
    else
      normalized = textValue(
        value,
        field,
        element.maxLength > 0 ? element.maxLength : 2000,
        element.required,
      );
    if (
      normalize &&
      ["phone", "person", "email", "text", "textarea"].includes(kind)
    )
      element.value = normalized;
    if (!element.validity.valid)
      throw new Error(`${field}: ${element.validationMessage}`);
  } catch (error) {
    element.setCustomValidity(error.message);
    return error.message;
  }
}
export function checkForm(form) {
  let first;
  for (const element of form.elements)
    if (typeof element.setCustomValidity === "function") {
      checkField(element, true);
      if (!element.checkValidity() && !first) first = element;
    }
  if (first) {
    first.focus();
    first.reportValidity();
    throw new Error(
      first.validationMessage || "Please correct the highlighted field.",
    );
  }
}
