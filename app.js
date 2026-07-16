function payload() {
  const note = [
    $('note').value.trim(),
    $('village').value.trim()
      ? `จุดสังเกต: ${$('village').value.trim()}`
      : '',
    `hazard=${$('hazard').value}`,
    `urgency=${$('urgency').value}`,
    $('reporter').value.trim()
      ? `reporter=${$('reporter').value.trim()}`
      : '',
    $('phone').value.trim()
      ? `phone=${$('phone').value.trim()}`
      : ''
  ].filter(Boolean).join('\n');

  return {
    project_code: C.PROJECT_CODE,
    province: $('province').value.trim(),
    district: $('district').value.trim(),
    subdistrict: $('subdistrict').value.trim(),
    cell_id: $('cellId').value.trim(),
    lat: $('lat').value.trim(),
    lng: $('lng').value.trim(),
    flood: $('flood').value,
    damage: $('damage').value,
    need: $('need').value,
    status: $('status').value,
    note,
    device: JSON.stringify({
      app: 'EAIV4-Mobile',
      version: C.APP_VERSION,
      userAgent: navigator.userAgent
    }),
    photos: photoData
  };
}
