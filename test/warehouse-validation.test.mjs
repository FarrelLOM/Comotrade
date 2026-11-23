import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWarehouseInput } from '../lib/warehouse-validation.mjs';

const validWarehouse = {
  name: 'Gudang Bandung',
  phone: '+62 812-3456-7890',
  addressLine: 'Jl. Merdeka No. 10, Bandung',
  areaId: '1234567890',
  zipcode: '40111',
  coordinate: '-6.914744,107.609810',
};

test('warehouse validation normalizes active flags and accepts a valid Jubelio origin', () => {
  const active = normalizeWarehouseInput(validWarehouse);
  const inactive = normalizeWarehouseInput({ ...validWarehouse, isActive: 'false', isDefault: 'false' });
  assert.equal(active.isActive, true);
  assert.equal(inactive.isActive, false);
  assert.equal(inactive.isDefault, false);
  assert.equal(inactive.coordinate, '-6.914744,107.609810');
});

test('default warehouse cannot be deactivated', () => {
  assert.throws(
    () => normalizeWarehouseInput({ ...validWarehouse, isDefault: true, isActive: false }),
    (error) => error.status === 400,
  );
});

test('warehouse phone must contain enough digits', () => {
  assert.throws(
    () => normalizeWarehouseInput({ ...validWarehouse, phone: '-------' }),
    (error) => error.status === 400,
  );
});
