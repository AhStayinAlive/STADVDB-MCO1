cube(`CreditMetricsCalculated`, {
  extends: CreditMetrics,
  
  measures: {
    // Year-over-Year Growth Calculations
    originationGrowthRate: {
      sql: `
        CASE 
          WHEN LAG(${CUBE}.origination_amt, 4) OVER (
            PARTITION BY ${CUBE}.geo_key, ${CUBE}.product_key 
            ORDER BY ${CUBE}.quarter_key
          ) > 0 
          THEN (
            (${CUBE}.origination_amt - LAG(${CUBE}.origination_amt, 4) OVER (
              PARTITION BY ${CUBE}.geo_key, ${CUBE}.product_key 
              ORDER BY ${CUBE}.quarter_key
            )) / LAG(${CUBE}.origination_amt, 4) OVER (
              PARTITION BY ${CUBE}.geo_key, ${CUBE}.product_key 
              ORDER BY ${CUBE}.quarter_key
            )
          ) * 100
          ELSE 0
        END
      `,
      type: `avg`,
      title: `Origination Growth Rate (%)`,
      format: `percent`
    },
    
    balanceGrowthRate: {
      sql: `
        CASE 
          WHEN LAG(${CUBE}.balance_amt, 4) OVER (
            PARTITION BY ${CUBE}.geo_key, ${CUBE}.product_key 
            ORDER BY ${CUBE}.quarter_key
          ) > 0 
          THEN (
            (${CUBE}.balance_amt - LAG(${CUBE}.balance_amt, 4) OVER (
              PARTITION BY ${CUBE}.geo_key, ${CUBE}.product_key 
              ORDER BY ${CUBE}.quarter_key
            )) / LAG(${CUBE}.balance_amt, 4) OVER (
              PARTITION BY ${CUBE}.geo_key, ${CUBE}.product_key 
              ORDER BY ${CUBE}.quarter_key
            )
          ) * 100
          ELSE 0
        END
      `,
      type: `avg`,
      title: `Balance Growth Rate (%)`,
      format: `percent`
    },
    
    // Market Share Calculations
    marketShareByProduct: {
      sql: `
        ${CUBE}.origination_amt / (
          SELECT SUM(origination_amt) 
          FROM fact_credit_metrics_qtr 
          WHERE quarter_key = ${CUBE}.quarter_key
        ) * 100
      `,
      type: `avg`,
      title: `Market Share by Product (%)`,
      format: `percent`
    },
    
    // Performance vs Average
    performanceVsAverage: {
      sql: `
        CASE 
          WHEN (
            SELECT AVG(origination_amt) 
            FROM fact_credit_metrics_qtr 
            WHERE quarter_key = ${CUBE}.quarter_key
          ) > 0
          THEN (
            (${CUBE}.origination_amt - (
              SELECT AVG(origination_amt) 
              FROM fact_credit_metrics_qtr 
              WHERE quarter_key = ${CUBE}.quarter_key
            )) / (
              SELECT AVG(origination_amt) 
              FROM fact_credit_metrics_qtr 
              WHERE quarter_key = ${CUBE}.quarter_key
            )
          ) * 100
          ELSE 0
        END
      `,
      type: `avg`,
      title: `Performance vs Average (%)`,
      format: `percent`
    },
    
    // Volatility Index (Standard Deviation of Quarterly Growth)
    volatilityIndex: {
      sql: `
        STDDEV(
          CASE 
            WHEN LAG(${CUBE}.origination_amt, 1) OVER (
              PARTITION BY ${CUBE}.geo_key, ${CUBE}.product_key 
              ORDER BY ${CUBE}.quarter_key
            ) > 0 
            THEN (
              (${CUBE}.origination_amt - LAG(${CUBE}.origination_amt, 1) OVER (
                PARTITION BY ${CUBE}.geo_key, ${CUBE}.product_key 
                ORDER BY ${CUBE}.quarter_key
              )) / LAG(${CUBE}.origination_amt, 1) OVER (
                PARTITION BY ${CUBE}.geo_key, ${CUBE}.product_key 
                ORDER BY ${CUBE}.quarter_key
              )
            ) * 100
            ELSE 0
          END
        ) OVER (
          PARTITION BY ${CUBE}.geo_key, ${CUBE}.product_key
        )
      `,
      type: `avg`,
      title: `Volatility Index`,
      format: `number`
    },
    
    // Portfolio Health Score (composite metric)
    portfolioHealthScore: {
      sql: `
        CASE 
          WHEN ${CUBE}.default_rate <= 0.02 THEN 100
          WHEN ${CUBE}.default_rate <= 0.05 THEN 80 - (${CUBE}.default_rate - 0.02) * 1000
          WHEN ${CUBE}.default_rate <= 0.10 THEN 50 - (${CUBE}.default_rate - 0.05) * 1000
          ELSE 0
        END
      `,
      type: `avg`,
      title: `Portfolio Health Score`,
      format: `number`
    },
    
    // Risk Reduction Target vs Actual
    riskReductionTarget: {
      sql: `0.02`, // 2% target default rate
      type: `number`,
      title: `Risk Reduction Target`,
      format: `percent`
    },
    
    riskReductionActual: {
      sql: `${CUBE}.default_rate`,
      type: `avg`,
      title: `Risk Reduction Actual`,
      format: `percent`
    },
    
    riskReductionGap: {
      sql: `${CUBE}.default_rate - 0.02`,
      type: `avg`,
      title: `Risk Reduction Gap`,
      format: `percent`
    }
  },
  
  dimensions: {
    // Risk Category with more granular breakdown
    riskCategoryDetailed: {
      sql: `
        CASE 
          WHEN ${CUBE}.default_rate > 0.10 THEN 'Critical Risk'
          WHEN ${CUBE}.default_rate > 0.05 THEN 'High Risk'
          WHEN ${CUBE}.default_rate BETWEEN 0.03 AND 0.05 THEN 'Medium-High Risk'
          WHEN ${CUBE}.default_rate BETWEEN 0.02 AND 0.03 THEN 'Medium Risk'
          WHEN ${CUBE}.default_rate BETWEEN 0.01 AND 0.02 THEN 'Low-Medium Risk'
          WHEN ${CUBE}.default_rate < 0.01 THEN 'Low Risk'
          ELSE 'Unknown'
        END
      `,
      type: `string`,
      title: `Risk Category Detailed`
    },
    
    // Performance Category
    performanceCategory: {
      sql: `
        CASE 
          WHEN ${CUBE}.origination_amt > (
            SELECT AVG(origination_amt) * 1.5 
            FROM fact_credit_metrics_qtr 
            WHERE quarter_key = ${CUBE}.quarter_key
          ) THEN 'Top Performer'
          WHEN ${CUBE}.origination_amt > (
            SELECT AVG(origination_amt) 
            FROM fact_credit_metrics_qtr 
            WHERE quarter_key = ${CUBE}.quarter_key
          ) THEN 'Above Average'
          WHEN ${CUBE}.origination_amt > (
            SELECT AVG(origination_amt) * 0.5 
            FROM fact_credit_metrics_qtr 
            WHERE quarter_key = ${CUBE}.quarter_key
          ) THEN 'Below Average'
          ELSE 'Underperformer'
        END
      `,
      type: `string`,
      title: `Performance Category`
    }
  }
});
