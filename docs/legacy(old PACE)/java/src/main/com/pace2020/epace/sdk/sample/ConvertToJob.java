package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.Date;
import java.util.GregorianCalendar;
import java.util.List;
import javax.xml.datatype.DatatypeConfigurationException;
import javax.xml.datatype.DatatypeFactory;

import com.pace2020.epace.object.Customer;
import com.pace2020.epace.object.Estimate;
import com.pace2020.epace.object.EstimateConvertToJob;
import com.pace2020.epace.object.EstimateQuantity;
import com.pace2020.epace.object.Job;
import com.pace2020.epace.object.JobType;
import com.pace2020.epace.object.Quote;
import com.pace2020.epace.object.QuoteConvertToJob;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;
import com.pace2020.epace.services.rpc.EstimateConvertToJobPart;

/**
 * @author <a href="mailto:jduval@pace2020.com">jerry duval</a>
 */
public class ConvertToJob extends SecuredWSDLClient
{
    public static void main( final String[] args ) throws Exception
    {
        final ConvertToJob convertJob = new ConvertToJob();

        convertJob.run();
    }

    public Job run() throws RemoteException, DatatypeConfigurationException
    {
        final GregorianCalendar gc = new GregorianCalendar();

        gc.setTime( new Date() );

        Customer cust = new Customer();

        cust.setId( "HOUSE" );

        JobType type = new JobType();

        type.setId( new Integer( 1 ) );

        Quote quote = new Quote();

        quote.setId( new Integer( 5066 ) );

        QuoteConvertToJob convertQuote = getInvokeActionPortType().getQuoteConvertToJob( quote );

        //Set some fields on the bean
        convertQuote.setDescription( "test foo convert" );
        convertQuote.setPoNumber( "test po" );
        convertQuote.setPromiseDate( DatatypeFactory.newInstance().newXMLGregorianCalendar( gc ) );

        if( null == convertQuote.getCustomer() )
        {
            convertQuote.setCustomer( cust );
        }
        else
        {
            cust = convertQuote.getCustomer();
        }

        convertQuote.setJobType( type );

        getInvokeActionPortType().convertQuoteToJob( convertQuote );

        Quote newQuote = getCloneObjectPortType().cloneQuote( quote, null, null, null );

        newQuote = getInvokeActionPortType().calculateQuote( newQuote );
        QuoteConvertToJob convertNewQuote = getInvokeActionPortType().getQuoteConvertToJob( newQuote );

        convertNewQuote.setDescription( "test foo clone/convert" );
        convertNewQuote.setPoNumber( "test po" );
        convertNewQuote.setPromiseDate( DatatypeFactory.newInstance().newXMLGregorianCalendar( gc ) );

        if( null == convertNewQuote.getCustomer() )
        {
            convertNewQuote.setCustomer( cust );
        }
        else
        {
            cust = convertNewQuote.getCustomer();
        }

        convertNewQuote.setJobType( type );

        getInvokeActionPortType().convertQuoteToJob( convertNewQuote );

        Estimate estimate = new Estimate();

        estimate.setId( new Integer( 44 ) );

        // Get a new Convert To Job bean for this estimate, bean is filled out with default data that is overridable
        EstimateConvertToJob convert = getInvokeActionPortType().getEstimateConvertToJob( estimate );

        //Set some fields on the bean
        convert.setDescription( "test foo convert" );
        convert.setPoNumber( "test po" );

        convert.setPromiseDate( DatatypeFactory.newInstance().newXMLGregorianCalendar( gc ) );

        if( null == convert.getCustomer() )
        {
            convert.setCustomer( cust );
        }
        else
        {
            cust = convert.getCustomer();
        }

        convert.setJobType( type );

        //See what Parts are avail for convert
        final List<EstimateConvertToJobPart> parts =
            convert.getEstimateConvertToJobParts().getEstimateConvertToJobPart();

        for( final EstimateConvertToJobPart part : parts )
        {
            EstimateQuantity qty = new EstimateQuantity();

            qty.setId( part.getQuantityToConvert().getId() );

            qty = getReadObjectPortType().readEstimateQuantity( qty );

            part.setSelected( true );

            System.out.println( "Part " + ( qty.getId() ) + " is avail for convert" );
            System.out.println( "Part " + ( qty.getId() ) + " description =" + part.getDescription() );
            System.out
                .println( "Part " + ( qty.getId() ) + " quantity to convert quoted price =" + part
                    .getQuantityToConvert()
                    .getQuotedPrice() );
            System.out.println( "Part " + ( qty.getId() ) + " quantity =" + qty.getQuantityOrdered() );

            // We can also change the QuanityToConvert by selecting another Qty avail on this part

            //part.getQuanities();

            // We can also choose not to convert this part

            //part.setSelected( Boolean.FALSE );
        }

        final Job convertTo = getInvokeActionPortType().convertEstimateToJob( convert );

        System.out.println( "Converted Estimate " + estimate.getId() + " to Job " + convertTo.getJob() );
        System.out.println( "Job Po Number = " + convertTo.getPoNum() );
        System.out.println( "Job Description = " + convertTo.getDescription() );

        Estimate newEstimate = getCloneObjectPortType().cloneEstimate( estimate, null, null, null );

        newEstimate = getInvokeActionPortType().calculateEstimate( newEstimate );

        return convertTo;
    }
}