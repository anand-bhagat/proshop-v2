// agent/helpers/validate.js — Parameter validation using JSON Schema (ajv)

import Ajv from 'ajv';
import mongoose from 'mongoose';

const ajv = new Ajv({ allErrors: true, coerceTypes: true });

function validateParams(params, schema) {
  const validate = ajv.compile(schema);
  const valid = validate(params);
  if (!valid) {
    const errors = validate.errors
      .map((e) => `${e.instancePath || '/'} ${e.message}`)
      .join('; ');
    return { valid: false, error: `Invalid parameters: ${errors}` };
  }
  return { valid: true };
}

function isValidObjectId(id) {
  return (
    mongoose.Types.ObjectId.isValid(id) &&
    String(new mongoose.Types.ObjectId(id)) === id
  );
}

export { validateParams, isValidObjectId };
