package com.pace2020.epace.sdk.sample;

import java.util.ArrayList;
import java.util.List;
import javax.xml.datatype.DatatypeConfigurationException;
import javax.xml.ws.Binding;
import javax.xml.ws.BindingProvider;
import javax.xml.ws.handler.Handler;

import com.pace2020.epace.object.Customer;
import com.pace2020.epace.sdk.createobject.CreateObject;
import com.pace2020.epace.sdk.createobject.CreateObjectPortType;
import com.pace2020.epace.sdk.deleteobject.DeleteObjectPortType;
import com.pace2020.epace.sdk.deleteobject.DeleteObject_Service;
import com.pace2020.epace.sdk.findobjects.FindObjects;
import com.pace2020.epace.sdk.findobjects.FindObjectsPortType;
import com.pace2020.epace.sdk.readobject.ReadObject;
import com.pace2020.epace.sdk.readobject.ReadObjectPortType;
import com.pace2020.epace.sdk.transactionservice.TransactionService;
import com.pace2020.epace.sdk.transactionservice.TransactionServicePortType;
import com.pace2020.epace.sdk.updateobject.UpdateObject;
import com.pace2020.epace.sdk.updateobject.UpdateObjectPortType;
import com.pace2020.epace.sdk.util.ClientServices;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

/**
 * @author <a href="mailto:nikhil.walvekar@efi.com">nikhil walvekar</a>
 */
@SuppressWarnings("rawtypes")
public class TransactionServiceSample extends SecuredWSDLClient
{
    public String transactionId;

    final TransactionServicePortType transactionService;
    final ReadObjectPortType readObjectPortType;
    final CreateObjectPortType createObjectPortType;
    final UpdateObjectPortType updateObjectPortType;
    final DeleteObjectPortType deleteObjectPortType;
    final FindObjectsPortType findObjectsPortType;
    final Binding transactionServiceBinding;
    final Binding updateObjectPortTypeBinding;
    final Binding deleteObjectPortTypeBinding;
    final Binding createObjectPortTypeBinding;
    final Binding findObjectsBinding;
    final Binding readObjectBinding;

    public TransactionServiceSample()
    {
        super();

        ClientServices.setupSecuredWSDLClient();

        transactionService = new TransactionService().getTransactionServiceHttpPort();
        readObjectPortType = new ReadObject().getReadObjectHttpPort();
        createObjectPortType = new CreateObject().getCreateObjectHttpPort();
        updateObjectPortType = new UpdateObject().getUpdateObjectHttpPort();
        deleteObjectPortType = new DeleteObject_Service().getDeleteObjectHttpPort();
        findObjectsPortType = new FindObjects().getFindObjectsHttpPort();
        transactionServiceBinding = ( (BindingProvider)transactionService ).getBinding();
        updateObjectPortTypeBinding = ( (BindingProvider)updateObjectPortType ).getBinding();
        deleteObjectPortTypeBinding = ( (BindingProvider)deleteObjectPortType ).getBinding();
        createObjectPortTypeBinding = ( (BindingProvider)createObjectPortType ).getBinding();
        findObjectsBinding = ( (BindingProvider)findObjectsPortType ).getBinding();
        readObjectBinding = ( (BindingProvider)readObjectPortType ).getBinding();

        ClientServices.setupPort( (BindingProvider)readObjectPortType );
        ClientServices.setupPort( (BindingProvider)createObjectPortType );
        ClientServices.setupPort( (BindingProvider)updateObjectPortType );
        ClientServices.setupPort( (BindingProvider)deleteObjectPortType );
        ClientServices.setupPort( (BindingProvider)findObjectsPortType );
        ClientServices.setupPort( (BindingProvider)transactionService );
    }

    public static void main( final String[] args ) throws Exception
    {
        final TransactionServiceSample txnSample = new TransactionServiceSample();
        txnSample.run();
        txnSample.timeout();
    }

	public void timeout() throws InterruptedException
    {
        List<Handler> transactionServiceBindingHandlers = new ArrayList<>();
        startTransaction( transactionServiceBindingHandlers, 1 );
        try
        {
            Thread.sleep( 60000 );

            transactionServiceBindingHandlers = new ArrayList<>();
            transactionServiceBindingHandlers.add( new CommitHandler( this.transactionId ) );
            transactionServiceBinding.setHandlerChain( transactionServiceBindingHandlers );
            transactionService.commit();
        }
        catch( Exception e )
        {
            System.out.println( "Transaction timed out" );
        }

    }

	public void run() throws DatatypeConfigurationException
    {

        List<Handler> updatehandlers = readObjectBinding.getHandlerChain();

        Customer customer = new Customer();

        List<Handler> transactionServiceBindingHandlers = new ArrayList<>();
        startTransaction( transactionServiceBindingHandlers, 1 );

        setTxnId( updatehandlers );
        try
        {
            for( int i = 0; i < 10; i++ )
            {
                customer.setId( "Q" + i );

                customer = createObjectPortType.createCustomer( customer );

                customer.setCustName( "" + i );
                customer.setAddress1( "  - " + i );

                updateObjectPortType.updateCustomer( customer );

                customer.setContactFirstName( "" + i );
                customer.setAddress2( "  - " + i );

                testFindInsideTxn( updatehandlers, customer );
                testFindOutsideTxn( customer );

                updateObjectPortType.updateCustomer( customer );

                customer = testReadInsideTxn( readObjectBinding, customer );
                customer = testReadOutsideTxn( readObjectBinding, customer );

                testDeleteInsideTxn( updatehandlers, customer );
            }

            transactionServiceBindingHandlers.add( new CommitHandler( this.transactionId ) );
            transactionServiceBinding.setHandlerChain( transactionServiceBindingHandlers );
            transactionService.commit();

            readObjectBinding.setHandlerChain( new ArrayList<>() );
            testFindOutsideTxn( customer );
            testReadOutsideTxn( readObjectBinding, customer );
        }
        catch( Exception e )
        {
            e.printStackTrace();
            rollback();
        }

    }

    private void rollback()
    {
        List<Handler> transactionServiceBindingHandlers;
        transactionServiceBindingHandlers = new ArrayList<>();
        transactionServiceBindingHandlers.add( new RollbackHandler( this.transactionId ) );
        transactionServiceBinding.setHandlerChain( transactionServiceBindingHandlers );
        transactionService.rollback();
    }

	private void setTxnId( List<Handler> updatehandlers )
    {
        updatehandlers.add( new TransactionHandler( this.transactionId ) );
        updateObjectPortTypeBinding.setHandlerChain( updatehandlers );
        findObjectsBinding.setHandlerChain( updatehandlers );
        createObjectPortTypeBinding.setHandlerChain( updatehandlers );
    }

	private void startTransaction( List<Handler> transactionServiceBindingHandlers, Integer timeout )
    {
        transactionServiceBindingHandlers.add( new StartTransactionHandler() );
        transactionServiceBinding.setHandlerChain( transactionServiceBindingHandlers );
        String txnId = transactionService.startTransaction( timeout );
        this.transactionId = txnId;
    }

	private void testDeleteInsideTxn( List<Handler> updatehandlers, Customer customer )
    {
        deleteObjectPortTypeBinding.setHandlerChain( updatehandlers );
        deleteObjectPortType.deleteObject( "Customer", customer.getId() );
    }

    private Customer testReadOutsideTxn( Binding readObjectBinding, Customer customer )
    {
        readObjectBinding.setHandlerChain( new ArrayList<>() );
        try
        {
            customer = readObjectPortType.readCustomer( customer );
        }
        catch( Exception e )
        {
        }
        return customer;
    }

	private Customer testReadInsideTxn( Binding readObjectBinding, Customer customer )
    {
        List<Handler> readObjectBindingHandlers;
        readObjectBindingHandlers = new ArrayList<>();
        readObjectBindingHandlers.add( new TransactionHandler( this.transactionId ) );
        readObjectBinding.setHandlerChain( readObjectBindingHandlers );
        customer = readObjectPortType.readCustomer( customer );
        return customer;
    }

	private void testFindInsideTxn( List<Handler> updatehandlers, Customer customer )
    {
        findObjectsBinding.setHandlerChain( updatehandlers );
        findObjectsPortType.find( "Customer", "@id='" + customer.getId() + "'" );
    }

    private void testFindOutsideTxn( Customer customer )
    {
        findObjectsBinding.setHandlerChain( new ArrayList<>() );
        try
        {
            findObjectsPortType.find( "Customer", "@id='" + customer.getId() + "'" );
        }
        catch( Exception e )
        {
            e.printStackTrace();
        }
    }
}