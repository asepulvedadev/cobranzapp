# Colombian identity field rules

Supported fields: firstNames, lastNames, fullName, documentNumber, documentType, country, nationality, birthDate, birthPlace, sex, height, bloodType, issueDate, issuePlace, expirationDate, serialNumber, mrzLines and barcodeData.

- `documentType`: `CC` only when the document explicitly says Cédula de Ciudadanía; otherwise `null`.
- `country`: `CO` only when Colombia is explicit.
- `sex`: preserve the printed code, normally `F` or `M`.
- `bloodType`: preserve ABO and Rh sign, such as `O+`.
- `height`: normalize the decimal separator to a dot without adding units.
- Never expose unstructured OCR text.
- Confidence is a number from 0 to 1 for the complete extraction.
- Warnings mention missing required form fields, front/back conflicts, cropped content, blur, glare or uncertain transcription.
