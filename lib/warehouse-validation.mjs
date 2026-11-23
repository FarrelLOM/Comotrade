export function normalizeWarehouseInput(input) {
  const data = input && typeof input === 'object' ? input : {};
  const isDefault = data.isDefault === true || data.isDefault === 'true' || data.isDefault === 1;
  const warehouse = {
    name: String(data.name || '').trim(),
    description: String(data.description || '').trim(),
    phone: String(data.phone || '').trim(),
    email: String(data.email || '').trim(),
    addressLine: String(data.addressLine || '').trim(),
    areaName: String(data.areaName || '').trim(),
    districtName: String(data.districtName || '').trim(),
    cityName: String(data.cityName || '').trim(),
    provinceName: String(data.provinceName || '').trim(),
    areaId: String(data.areaId || '').trim(),
    zipcode: String(data.zipcode || '').trim(),
    coordinate: String(data.coordinate || '').trim(),
    isDefault,
    isActive: data.isActive === undefined || data.isActive === true || data.isActive === 'true' || data.isActive === 1,
  };
  const coordinate = warehouse.coordinate.replace(/[()]/g, '').split(',').map((part) => Number(part.trim()));
  const coordinateValid = !warehouse.coordinate || (
    coordinate.length === 2 && coordinate.every(Number.isFinite) &&
    Math.abs(coordinate[0]) <= 90 && Math.abs(coordinate[1]) <= 180
  );
  if (warehouse.name.length < 2 || warehouse.name.length > 160 ||
      warehouse.description.length > 4000 ||
      !/^\+?[0-9 ()-]{7,30}$/.test(warehouse.phone) || (warehouse.phone.match(/\d/g) || []).length < 7 ||
      (warehouse.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(warehouse.email)) ||
      warehouse.addressLine.length < 8 || warehouse.addressLine.length > 1000 ||
      !/^\d{10}$/.test(warehouse.areaId) || !/^\d{4,10}$/.test(warehouse.zipcode) ||
      !coordinateValid || warehouse.coordinate.length > 80 ||
      [warehouse.areaName, warehouse.districtName, warehouse.cityName, warehouse.provinceName].some((value) => value.length > 200) ||
      (warehouse.isDefault && !warehouse.isActive)) {
    throw Object.assign(new Error('Data gudang tidak valid. Isi nama, kontak, alamat, area_id Jubelio, dan kode pos.'), { status: 400 });
  }
  return warehouse;
}
