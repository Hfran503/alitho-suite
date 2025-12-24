package com.pace2020.epace.sdk.sample;

import com.pace2020.appbox.services.rpc.EstimateInfo;
import com.pace2020.appbox.services.rpc.EstimatePartInfo;
import com.pace2020.epace.object.Estimate;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

public class CreateEstimate extends SecuredWSDLClient
{

    public CreateEstimate()
    {
        super();
    }

    public static void main( String[] args ) throws Exception
    {
        //Check to make sure we have 1 parameter passed in
        if( args.length != 1 )
        {
            throw new Exception( "Usage: InvokeAction <id>" );
        }
        else
        {
            CreateEstimate createEstimate = new CreateEstimate();
            Estimate estimate = createEstimate.createEstimate( "HOUSE" );
            System.out.println( estimate.getEstimateNumber() );
        }
    }

    public Estimate createEstimate( final String customer )
    {
        return addEstimate( customer );
    }

    public Estimate addEstimate( final String customer )
    {
        final EstimateInfo estimateInfo = createEstimateInfo( customer );
        final EstimatePartInfo estimatePartInfo = CreateEstimatePart.createEstimatePartInfo( null );
        estimateInfo.setEstimatePartInfo( estimatePartInfo );

        return getInvokeActionPortType().createEstimate( estimateInfo );
    }

    private EstimateInfo createEstimateInfo( final String customer )
    {
        final EstimateInfo estimateInfo = new EstimateInfo();
        estimateInfo.setCustomer( customer );
        estimateInfo.setEstimateDescription( "TEST Description" );

        return estimateInfo;
    }

}
