interface IInput {
    'Rs/Litre': string
    'Rs/Litre_2': string
    'Gas Oil': string
}

interface IOutput {
    'date': string
    'petrol': string
    'diesel': string
}

export const sanitize = (input: IInput[][]): IOutput[] => {
    let output: IInput[] = input[0]
    let process = output.map(row => {
        let keys = Object.keys(row)
        return {
            date: row[keys[0]],
            petrol: row[keys[1]],
            diesel: row[keys[2]]
        }
    })
    return process
}