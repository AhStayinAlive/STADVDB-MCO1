cube(`DateDimension`, {
  sql: `SELECT * FROM dim_date_qtr`,
  
  measures: {
    count: {
      type: `count`,
      drillMembers: [year, quarter, quarterStart]
    }
  },

  dimensions: {
    quarterKey: {
      sql: `${CUBE}.quarter_key`,
      type: `string`,
      primaryKey: true,
      title: `Quarter Key`
    },
    
    year: {
      sql: `${CUBE}.year`,
      type: `number`,
      title: `Year`
    },
    
    quarter: {
      sql: `${CUBE}.quarter`,
      type: `number`,
      title: `Quarter`
    },
    
    quarterLabel: {
      sql: `CONCAT(${CUBE}.year, ' Q', ${CUBE}.quarter)`,
      type: `string`,
      title: `Quarter Label`
    },
    
    quarterStart: {
      sql: `${CUBE}.quarter_start`,
      type: `time`,
      title: `Quarter Start`
    },
    
    quarterEnd: {
      sql: `${CUBE}.quarter_end`,
      type: `time`,
      title: `Quarter End`
    },
    
    yearQuarter: {
      sql: `${CUBE}.year * 10 + ${CUBE}.quarter`,
      type: `number`,
      title: `Year Quarter`
    }
  }
});
