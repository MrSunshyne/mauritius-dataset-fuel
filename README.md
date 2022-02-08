# Mauritius Fuel Open Dataset

This repo keep an updated dataset of the Mauritius fuel prices by getting them from the State Trading Cooporation website using a Github Action at a regular 
interval.

## Dataset

### [View Dataset](https://github.com/MrSunshyne/mauritius-fuel-dataset/blob/main/data/latest.json)



The aim is to provide a hassle-free way to use the data to build applications.

## Example applications
-  Mauritius Fuel Prices - https://mauritius-fuel-prices.netlify.app/

## Disclaimers

- The maintainer of this repository is NOT affiliated with the STC.
- The data is automatically fetched from the STC website but not provided directly by them.
- The page from which the data is fetched is [publicly available](https://www.stcmu.com/ppm/retail-prices).
- The data is fetched at a rate of 1 time every 24hours.
- The data is made available here under fair use.

## FAQ


<details>
  <summary>Why not use the STC website directly?</summary>
  
- Although the data is available publicly and for free, it is not in a suitable open format that would enable developers or students to build applications reliably

</details>

<details>
  <summary>In which format is the data provided?</summary>
  
- JSON
- The shape is as follows: 

```

[
    {
        'date': string
        'petrol': string
        'diesel': string
    },
    {
        ...
    }
]
```

</details>
