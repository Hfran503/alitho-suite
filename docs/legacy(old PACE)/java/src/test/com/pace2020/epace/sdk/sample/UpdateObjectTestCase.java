package com.pace2020.epace.sdk.sample;

import com.pace2020.epace.object.Job;
import com.pace2020.epace.object.JobPart;
import com.pace2020.epace.sdk.AbstractSecuredWSDLClient;

public class UpdateObjectTestCase extends AbstractSecuredWSDLClient
{
    public void testUpdateRequiredFieldToNull() throws Exception
    {
        Job job = new Job();
        job.setCustomer( "HOUSE" );
        job.setQtyOrdered( 10.0 );

        job = getCreateObjectPortType().createJob( job );

        JobPart part = new JobPart();
        part.setJob( job.getJob() );
        part.setJobPart( "01" );
        part = getJobPart( part.getJobPart(), job );

        //read one of the required field and test for null
        String requiredFieldValue = requiredFieldValue = part.getProductionStatus();
        assertTrue( null != requiredFieldValue && requiredFieldValue.length() > 0 );

        //try to set few required fields to null and update
        part.setProductionStatus( null ); //string
        part.setSalesCategory( null ); //integer
        getUpdateObjectPortType().updateJobPart( part );

        //re-read the object from server
        part = getJobPart( part.getJobPart(), job );

        //it should still not be null in server
        requiredFieldValue = part.getProductionStatus();
        assertTrue( null != requiredFieldValue && requiredFieldValue.length() > 0 );
        assertTrue( null != part.getSalesCategory() );
    }

}