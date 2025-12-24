package com.pace2020.epace.sdk.sample;

import com.pace2020.appbox.services.rpc.EstimatePaperInfo;
import com.pace2020.appbox.services.rpc.EstimatePartInfo;
import com.pace2020.appbox.services.rpc.EstimatePressInfo;
import com.pace2020.epace.object.EstimatePart;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

public class CreateEstimatePart extends SecuredWSDLClient
{

    public static void main( String[] args ) throws Exception
    {
        // Check to make sure we have 1 parameter passed in
        if( args.length != 1 )
        {
            throw new Exception( "Usage: InvokeAction <id>" );
        }
        else
        {
            createEstimatePart( args[0] );
        }
    }

    public static EstimatePart createEstimatePart( final String estimateNumber )
    {
        CreateEstimatePart createEstimatePart = new CreateEstimatePart();
        return createEstimatePart.addEstimatePart( estimateNumber );
    }

    private EstimatePart addEstimatePart( final String estimateNumber )
    {
        final EstimatePartInfo estimatePartInfo = createEstimatePartInfo( estimateNumber );

        return getInvokeActionPortType().addEstimatePart( estimatePartInfo );
    }

    public static EstimatePartInfo createEstimatePartInfo( final String estimate )
    {
        final EstimatePartInfo estimatePartInfo = createEstimatePartInfo();
        estimatePartInfo.setEstimateID( estimate );

        final EstimatePaperInfo estimatePaperInfo = createEstimatePaperInfo();
        final EstimatePressInfo estimatePressInfo = createEstimatePressInfo();

        estimatePartInfo.setEstimatePaperInfo( estimatePaperInfo );
        estimatePartInfo.setEstimatePressInfo( estimatePressInfo );

        return estimatePartInfo;
    }

    private static EstimatePressInfo createEstimatePressInfo()
    {
        final EstimatePressInfo estimatePressInfo = new EstimatePressInfo();
        estimatePressInfo.setPrimaryPress( 1 );
        estimatePressInfo.setRunMethod( 1 );
        estimatePressInfo.setRunSizeH( 6.0 );
        estimatePressInfo.setRunSizeW( 6.0 );
        estimatePressInfo.setRunSizeGrainDirection( 2 );
        return estimatePressInfo;
    }

    private static EstimatePartInfo createEstimatePartInfo()
    {
        final EstimatePartInfo estimatePartInfo = new EstimatePartInfo();

        estimatePartInfo.setFoldPattern( "2:1" );
        estimatePartInfo.setFinalSizeH( new Double( 12 ) );
        estimatePartInfo.setFinalSizeW( new Double( 22 ) );
        estimatePartInfo.setEachOf( 22 );
        estimatePartInfo.setNumPlies( 32 );
        estimatePartInfo.setPressInkType( 2 );
        estimatePartInfo.setBindingMethod( 1 );
        estimatePartInfo.setPrepressWorkflow( 4 );
        estimatePartInfo.setGrainSpecifications( 2 );
        estimatePartInfo.setProduct( "FL" );

        // estimatePartInfo.setCompositeProduct(5001);
        estimatePartInfo.setColorsSide1( 4 );
        estimatePartInfo.setColorsSide2( 4 );
        estimatePartInfo.setTotalColors( 4 );
        estimatePartInfo.setInkCoverageFront( 3 );

        estimatePartInfo.setInkCoverageBack( 3 );

        estimatePartInfo.setQuantity1( 1000 );
        estimatePartInfo.setQuantity2( 2000 );
        estimatePartInfo.setQuantity1Desc( " qty1 desc " );
        estimatePartInfo.setQuantity2Desc( " qty2 desc " );

        return estimatePartInfo;
    }

    private static EstimatePaperInfo createEstimatePaperInfo()
    {
        final EstimatePaperInfo estimatePaperInfo = new EstimatePaperInfo();
        estimatePaperInfo.setMaterialType( "InventoryItem" );
        estimatePaperInfo.setInventoryItem( "1001" );
        estimatePaperInfo.setWeight( 5002 );
        estimatePaperInfo.setUom( "EA" );
        estimatePaperInfo.setBuySizeGrainDirection( 2 );
        estimatePaperInfo.setBuySizeH( 5.0 );
        estimatePaperInfo.setBuySizeW( 5.0 );
        return estimatePaperInfo;
    }

}
