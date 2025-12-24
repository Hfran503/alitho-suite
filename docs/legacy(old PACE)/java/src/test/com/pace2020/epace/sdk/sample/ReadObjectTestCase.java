package com.pace2020.epace.sdk.sample;

import com.pace2020.epace.object.CostCenter;
import com.pace2020.epace.object.InventoryBin;
import com.pace2020.epace.sdk.util.APICRUDClient;
import com.pace2020.epace.sdk.util.DataObjectWrapper;
import junit.framework.TestCase;

public class ReadObjectTestCase extends TestCase
{
    public void testReadUsingPrimaryKey() throws Exception
    {
        APICRUDClient apiClient = new APICRUDClient();

        //test using singular primary key
        CostCenter costCenter = new CostCenter();
        costCenter.setPrimaryKey( "000" );
        DataObjectWrapper objectWrapper = new DataObjectWrapper( costCenter );

        costCenter = (CostCenter)apiClient.readDataObject( objectWrapper );
        assertEquals( "000", costCenter.getId() );

        //test using composite primary key
        InventoryBin inventoryBin = new InventoryBin();
        inventoryBin.setPrimaryKey( "DEFAULT:DEFAULT" );
        objectWrapper = new DataObjectWrapper( inventoryBin );

        inventoryBin = (InventoryBin)apiClient.readDataObject( objectWrapper );
        assertEquals( "DEFAULT", inventoryBin.getCode() );
        assertEquals( "DEFAULT", inventoryBin.getInventoryLocation() );
    }
}