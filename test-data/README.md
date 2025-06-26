# Test Data

This directory contains sample datasets for testing the data analysis application.

## Files

### clinical-trials.csv
- Clinical trial data with company information, phases, and drug details
- Contains missing values in various fields (Company, Drug Name, Market Cap, IC50)
- Good for testing: data validation, missing value completion, web research

### lab-measurements.csv
- Laboratory measurement data with concentrations in ng/mL
- Contains missing values in Molecular Weight, Temperature, pH, and Technician fields
- Good for testing: unit conversions (ng/mL to µM), range validation, missing data

### drug-discovery.json
- Drug discovery compound data in JSON format
- Contains chemical properties and biological activity data
- Some entries have null values for IC50, selectivity ratio, and cell line
- Good for testing: JSON import, chemical data validation, property calculations

## Usage

These files can be uploaded directly to the application to test various features:
1. Data import and parsing
2. Row and column selection
3. Validation tasks
4. Missing value research
5. Unit conversions
6. Range checks