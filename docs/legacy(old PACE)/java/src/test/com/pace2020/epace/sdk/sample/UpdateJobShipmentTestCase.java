package com.pace2020.epace.sdk.sample;

import com.pace2020.epace.object.JobShipment;
import junit.framework.TestCase;

public class UpdateJobShipmentTestCase extends TestCase
{
    public void testUpdateJobShipment() throws Exception
    {
        final ReadJobShipment readJS = new ReadJobShipment( "5001" );
        JobShipment js = readJS.run();

        js.setCountry( new Integer( 3 ) );
        js.setState( "PU" );
        js.setStateKey( "3:PU" );

        String newName = "TEST SET NAME";

        final UpdateJobShipment updateJS = new UpdateJobShipment( js );
        updateJS.run( newName );

        final JobShipment js12 = readJS.run();
        assertTrue( js12.getCountry().equals( new Integer( 3 ) ) );


    }

}