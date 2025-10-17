cube(`ProductDimension`, {
  sql: `SELECT * FROM dim_product`,
  
  measures: {
    count: {
      type: `count`,
      drillMembers: [productType, productCode, segment]
    }
  },

  dimensions: {
    productKey: {
      sql: `${CUBE}.product_key`,
      type: `string`,
      primaryKey: true,
      title: `Product Key`
    },
    
    productCode: {
      sql: `${CUBE}.product_code`,
      type: `string`,
      title: `Product Code`
    },
    
    productType: {
      sql: `${CUBE}.product_type`,
      type: `string`,
      title: `Product Type`
    },
    
    segment: {
      sql: `${CUBE}.segment`,
      type: `string`,
      title: `Segment`
    },
    
    productDescription: {
      sql: `CONCAT_WS(' - ', ${CUBE}.product_type, ${CUBE}.segment)`,
      type: `string`,
      title: `Product Description`
    }
  }
});
