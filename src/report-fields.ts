export const reportFields = {
  main: [
    ['code', 'Označenie'], ['name', 'Názov'], ['color', 'Farba / variant'], ['image', 'Ilustračný obrázok'], ['price', 'Cena za kus'], ['quantity', 'Množstvo'], ['total', 'Suma'], ['url', 'Odkaz'], ['dimensions', 'Rozmery'], ['note', 'Poznámka']
  ],
  alternative: [
    ['name', 'Názov'], ['color', 'Farba / variant'], ['image', 'Ilustračný obrázok'], ['price', 'Cena za kus'], ['quantity', 'Množstvo'], ['total', 'Suma'], ['url', 'Odkaz'], ['dimensions', 'Rozmery'], ['note', 'Poznámka']
  ]
} as const

export type MainField = typeof reportFields.main[number][0]
export type AlternativeField = typeof reportFields.alternative[number][0]
export type ReportSelection = { main: MainField[]; alternative: AlternativeField[] }
export const defaultReportSelection = (): ReportSelection => ({
  main: reportFields.main.map(([key]) => key).filter(key => key !== 'dimensions'),
  alternative: reportFields.alternative.map(([key]) => key).filter(key => key !== 'dimensions')
})
