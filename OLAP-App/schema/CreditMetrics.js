cube(`CreditMetrics`, {
  sql: `SELECT * FROM fact_credit_metrics_qtr`,
  
  joins: {
    DateDimension: {
      sql: `${CUBE}.quarter_key = ${DateDimension}.quarter_key`,
      relationship: `belongsTo`
    },
    GeographyDimension: {
      sql: `${CUBE}.geo_key = ${GeographyDimension}.geo_key`,
      relationship: `belongsTo`
    },
    ProductDimension: {
      sql: `${CUBE}.product_key = ${ProductDimension}.product_key`,
      relationship: `belongsTo`
    }
  },

  measures: {
    // Origination Metrics
    totalOriginations: {
      sql: `${CUBE}.originations_cnt`,
      type: `sum`,
      title: `Total Originations Count`
    },
    
    totalOriginationAmount: {
      sql: `${CUBE}.origination_amt`,
      type: `sum`,
      title: `Total Origination Amount`,
      format: `currency`
    },
    
    averageOriginationPerAccount: {
      sql: `${CUBE}.origination_amt / ${CUBE}.originations_cnt`,
      type: `number`,
      title: `Average Origination per Account`,
      format: `currency`
    },
    
    // Balance Metrics
    totalBalanceAmount: {
      sql: `${CUBE}.balance_amt`,
      type: `sum`,
      title: `Total Balance Amount`,
      format: `currency`
    },
    
    balanceToOriginationRatio: {
      sql: `${CUBE}.balance_amt / ${CUBE}.origination_amt`,
      type: `number`,
      title: `Balance to Origination Ratio`
    },
    
    // Risk Metrics
    averageDefaultRate: {
      sql: `${CUBE}.default_rate`,
      type: `avg`,
      title: `Average Default Rate`,
      format: `percent`
    },
    
    averagePrimeRate: {
      sql: `${CUBE}.prime_rate`,
      type: `avg`,
      title: `Average Prime Rate`,
      format: `percent`
    },
    
    averageLendingRate: {
      sql: `${CUBE}.lending_rate`,
      type: `avg`,
      title: `Average Lending Rate`,
      format: `percent`
    },
    
    primeLendingSpread: {
      sql: `${CUBE}.prime_rate - ${CUBE}.lending_rate`,
      type: `avg`,
      title: `Prime Lending Spread`,
      format: `percent`
    },
    
    // Risk Categories
    highRiskAccounts: {
      sql: `CASE WHEN ${CUBE}.default_rate > 0.05 THEN ${CUBE}.originations_cnt ELSE 0 END`,
      type: `sum`,
      title: `High Risk Accounts`
    },
    
    mediumRiskAccounts: {
      sql: `CASE WHEN ${CUBE}.default_rate BETWEEN 0.02 AND 0.05 THEN ${CUBE}.originations_cnt ELSE 0 END`,
      type: `sum`,
      title: `Medium Risk Accounts`
    },
    
    lowRiskAccounts: {
      sql: `CASE WHEN ${CUBE}.default_rate < 0.02 THEN ${CUBE}.originations_cnt ELSE 0 END`,
      type: `sum`,
      title: `Low Risk Accounts`
    }
  },

  dimensions: {
    quarterKey: {
      sql: `${CUBE}.quarter_key`,
      type: `string`,
      primaryKey: true,
      title: `Quarter Key`
    },
    
    geoKey: {
      sql: `${CUBE}.geo_key`,
      type: `string`,
      title: `Geography Key`
    },
    
    productKey: {
      sql: `${CUBE}.product_key`,
      type: `string`,
      title: `Product Key`
    },
    
    riskCategory: {
      sql: `CASE 
        WHEN ${CUBE}.default_rate > 0.05 THEN 'High Risk'
        WHEN ${CUBE}.default_rate BETWEEN 0.02 AND 0.05 THEN 'Medium Risk'
        WHEN ${CUBE}.default_rate < 0.02 THEN 'Low Risk'
        ELSE 'Unknown'
      END`,
      type: `string`,
      title: `Risk Category`
    }
  },

  // Pre-aggregations for performance
  preAggregations: {
    creditMetricsByQuarter: {
      measures: [
        CreditMetrics.totalOriginations,
        CreditMetrics.totalOriginationAmount,
        CreditMetrics.totalBalanceAmount,
        CreditMetrics.averageDefaultRate,
        CreditMetrics.primeLendingSpread
      ],
      dimensions: [DateDimension.year, DateDimension.quarter],
      timeDimension: DateDimension.quarterStart,
      granularity: `quarter`,
      refreshKey: {
        every: `1 hour`
      }
    },
    
    creditMetricsByProduct: {
      measures: [
        CreditMetrics.totalOriginations,
        CreditMetrics.totalOriginationAmount,
        CreditMetrics.averageDefaultRate,
        CreditMetrics.primeLendingSpread
      ],
      dimensions: [ProductDimension.productType, ProductDimension.segment],
      timeDimension: DateDimension.quarterStart,
      granularity: `quarter`,
      refreshKey: {
        every: `1 hour`
      }
    },
    
    creditMetricsByGeography: {
      measures: [
        CreditMetrics.totalOriginations,
        CreditMetrics.totalOriginationAmount,
        CreditMetrics.averageDefaultRate
      ],
      dimensions: [GeographyDimension.country, GeographyDimension.stateProvince],
      timeDimension: DateDimension.quarterStart,
      granularity: `quarter`,
      refreshKey: {
        every: `1 hour`
      }
    }
  }
});
